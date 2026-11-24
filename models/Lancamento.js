const pool = require('../database/connection');

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
  async listar(usuarioId) {
    const [linhas] = await pool.promise().execute(
      selecionarLancamentos + ' WHERE l.usuario_id = ? ORDER BY l.data DESC, l.id DESC',
      [usuarioId],
    );
    return linhas.map(formatarLancamento);
  }

  async buscarPorId(id, usuarioId, conexao = pool.promise()) {
    const [[linha]] = await conexao.execute(
      selecionarLancamentos + ' WHERE l.id = ? AND l.usuario_id = ?',
      [id, usuarioId],
    );
    return linha ? formatarLancamento(linha) : null;
  }

  async salvar(usuarioId, { tipo, descricao, valor, data, categoriaId, fonteDestinoId }, id) {
    const conexao = await pool.promise().getConnection();
    try {
      await conexao.beginTransaction();
      if (id !== undefined) {
        const [[existente]] = await conexao.execute(
          'SELECT id FROM lancamentos WHERE id = ? AND usuario_id = ? FOR UPDATE',
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
        'SELECT id FROM fontes_destinos WHERE id = ? AND usuario_id = ? FOR SHARE',
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
}

module.exports = new Lancamento();
