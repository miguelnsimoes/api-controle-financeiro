const { randomUUID } = require('node:crypto');
const pool = require('../database/connection');
const { dividirEmParcelas } = require('../utils/validarLancamento');
const itensPorPagina = 20;

const selecionarLancamentos = `
  SELECT l.id, l.tipo, l.descricao, l.valor, l.data,
         l.categoria_id, c.nome AS categoria_nome,
         l.fonte_destino_id, f.nome AS fonte_destino_nome,
         l.parcela_atual, l.total_parcelas
  FROM lancamentos l
  JOIN categorias c ON c.id = l.categoria_id AND c.usuario_id = l.usuario_id
  JOIN fontes_destinos f ON f.id = l.fonte_destino_id AND f.usuario_id = l.usuario_id
`;

function formatarLancamento(linha) {
  return {
    id: linha.id,
    tipo: linha.tipo,
    descricao: linha.descricao,
    valor: Number(linha.valor),
    data: linha.data,
    categoria: { id: linha.categoria_id, nome: linha.categoria_nome },
    fonteDestino: { id: linha.fonte_destino_id, nome: linha.fonte_destino_nome },
    parcela: `${linha.parcela_atual}/${linha.total_parcelas}`,
  };
}

class Lancamento {
  async listar(usuarioId, { inicio, fim, tipo, categoriaId, fonteDestinoId, pagina }) {
    const condicoes = ['l.usuario_id = ?'];
    const parametros = [usuarioId];
    for (const [condicao, valor] of [
      ['l.data >= ?', inicio],
      ['l.data <= ?', fim],
      ['l.tipo = ?', tipo],
      ['l.categoria_id = ?', categoriaId],
      ['l.fonte_destino_id = ?', fonteDestinoId],
    ]) {
      if (valor === null) continue;
      condicoes.push(condicao);
      parametros.push(valor);
    }

    const deslocamento = BigInt(pagina - 1) * BigInt(itensPorPagina);
    const [linhas] = await pool.promise().execute(
      `WITH filtrados AS (
         ${selecionarLancamentos} WHERE ${condicoes.join(' AND ')}
       ), totais AS (
         SELECT COUNT(*) AS quantidade,
                COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS entradas,
                COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS saidas
         FROM filtrados
       ), itens AS (
         SELECT * FROM filtrados ORDER BY data DESC, id DESC LIMIT ${itensPorPagina} OFFSET ?
       )
       SELECT itens.*, totais.quantidade, totais.entradas, totais.saidas,
              totais.entradas - totais.saidas AS saldo,
              (? IS NULL OR EXISTS (
                 SELECT 1 FROM categorias WHERE id = ? AND usuario_id = ?
              )) AS categoria_valida,
              (? IS NULL OR EXISTS (
                 SELECT 1 FROM fontes_destinos WHERE id = ? AND usuario_id = ?
              )) AS fonte_destino_valida
       FROM totais LEFT JOIN itens ON TRUE
       ORDER BY itens.data DESC, itens.id DESC`,
      [...parametros, deslocamento.toString(),
        categoriaId, categoriaId, usuarioId, fonteDestinoId, fonteDestinoId, usuarioId],
    );
    const total = linhas[0];
    if (!total.categoria_valida) return { ausente: 'Categoria não encontrada.' };
    if (!total.fonte_destino_valida) return { ausente: 'Fonte ou destino não encontrado.' };

    return {
      periodo: { inicio, fim },
      resumo: {
        entradas: Number(total.entradas),
        saidas: Number(total.saidas),
        saldo: Number(total.saldo),
      },
      pagina,
      totalPaginas: Math.ceil(total.quantidade / itensPorPagina),
      itens: total.id === null ? [] : linhas.map(formatarLancamento),
    };
  }

  async buscarPorId(id, usuarioId, conexao = pool.promise()) {
    const [[linha]] = await conexao.execute(
      selecionarLancamentos + ' WHERE l.id = ? AND l.usuario_id = ?',
      [id, usuarioId],
    );
    return linha ? formatarLancamento(linha) : null;
  }

  async salvar(usuarioId, { tipo, descricao, valor, data, categoriaId, fonteDestinoId, parcelas }, id) {
    const conexao = await pool.promise().getConnection();
    try {
      await conexao.beginTransaction();
      let existente;
      if (id !== undefined) {
        [[existente]] = await conexao.execute(
          `SELECT grupo_parcelamento, data, valor, fonte_destino_id
           FROM lancamentos WHERE id = ? AND usuario_id = ? FOR UPDATE`,
          [id, usuarioId],
        );
        if (!existente) {
          await conexao.rollback();
          return { ausente: 'Lançamento não encontrado.' };
        }
      }

      const [[categoria]] = await conexao.execute(
        'SELECT tipo FROM categorias WHERE id = ? AND usuario_id = ? FOR SHARE',
        [categoriaId, usuarioId],
      );
      const [[fonteDestino]] = await conexao.execute(
        'SELECT tipo FROM fontes_destinos WHERE id = ? AND usuario_id = ? FOR SHARE',
        [fonteDestinoId, usuarioId],
      );
      if (!categoria || !fonteDestino) {
        await conexao.rollback();
        return { ausente: !categoria ? 'Categoria não encontrada.' : 'Fonte ou destino não encontrado.' };
      }
      if (categoria.tipo !== tipo) {
        await conexao.rollback();
        return { campos: { categoriaId: 'O tipo da categoria deve ser igual ao do lançamento.' } };
      }
      const grupoExistente = existente?.grupo_parcelamento;
      if (grupoExistente) {
        const campos = {};
        if (data !== existente.data) campos.data = 'A data original da compra parcelada deve ser mantida.';
        if (valor !== Number(existente.valor)) campos.valor = 'O valor da parcela deve ser mantido.';
        if (fonteDestinoId !== existente.fonte_destino_id) {
          campos.fonteDestinoId = 'O cartão da compra parcelada deve ser mantido.';
        }
        if (Object.keys(campos).length) {
          await conexao.rollback();
          return { campos };
        }
      }
      if ((parcelas !== undefined || grupoExistente) && (fonteDestino.tipo !== 'cartao_credito' || tipo !== 'saida')) {
        await conexao.rollback();
        const campo = grupoExistente ? 'fonteDestinoId' : 'parcelas';
        return { campos: { [campo]: 'O parcelamento exige uma saída vinculada a um cartão de crédito.' } };
      }

      if (parcelas !== undefined) {
        const grupo = randomUUID();
        const valoresParcelas = dividirEmParcelas(valor, parcelas);
        const lancamentos = [];
        for (const [indice, valorParcela] of valoresParcelas.entries()) {
          const [resultado] = await conexao.execute(
            `INSERT INTO lancamentos
               (tipo, descricao, valor, data, categoria_id, fonte_destino_id, usuario_id,
                parcela_atual, total_parcelas, grupo_parcelamento)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [tipo, descricao, valorParcela, data, categoriaId, fonteDestinoId, usuarioId,
              indice + 1, parcelas, grupo],
          );
          lancamentos.push(await this.buscarPorId(resultado.insertId, usuarioId, conexao));
        }
        await conexao.commit();
        return { lancamentos };
      }

      const valores = [tipo, descricao, valor, data, categoriaId, fonteDestinoId];
      if (id === undefined) {
        const [resultado] = await conexao.execute(
          `INSERT INTO lancamentos
             (tipo, descricao, valor, data, categoria_id, fonte_destino_id, usuario_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [...valores, usuarioId],
        );
        id = resultado.insertId;
      } else {
        await conexao.execute(
          `UPDATE lancamentos SET tipo = ?, descricao = ?, valor = ?, data = ?,
             categoria_id = ?, fonte_destino_id = ?
           WHERE id = ? AND usuario_id = ?`,
          [...valores, id, usuarioId],
        );
      }

      const lancamento = await this.buscarPorId(id, usuarioId, conexao);
      await conexao.commit();
      return { lancamento };
    } catch (error) {
      await conexao.rollback();
      throw error;
    } finally {
      conexao.release();
    }
  }

  async excluir(id, usuarioId) {
    const [resultado] = await pool.promise().execute(
      'DELETE FROM lancamentos WHERE id = ? AND usuario_id = ?',
      [id, usuarioId],
    );
    return resultado.affectedRows > 0;
  }

  async excluirGrupo(id, usuarioId) {
    const sql = `DELETE parcela FROM lancamentos parcela
                 JOIN lancamentos origem ON origem.usuario_id = parcela.usuario_id
                   AND (origem.id = parcela.id OR origem.grupo_parcelamento = parcela.grupo_parcelamento)
                 WHERE origem.id = ? AND origem.usuario_id = ?`;
    const executar = () => pool.promise().execute(sql, [id, usuarioId]);
    const [resultado] = await executar().catch((error) => {
      // O InnoDB desfaz a exclusão inteira quando escolhe esta operação como vítima.
      if (error.code !== 'ER_LOCK_DEADLOCK') throw error;
      return executar();
    });
    return resultado.affectedRows > 0;
  }
}

module.exports = new Lancamento();
