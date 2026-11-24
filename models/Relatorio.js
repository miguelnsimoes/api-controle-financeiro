const pool = require('../database/connection');

class Relatorio {
  async totaisPorCategoria(usuarioId, inicio, fim) {
    const [linhas] = await pool.promise().execute(
      `SELECT c.id, c.nome, l.tipo, SUM(l.valor) AS total
       FROM lancamentos l
       INNER JOIN categorias c ON c.id = l.categoria_id AND c.usuario_id = l.usuario_id
       WHERE l.usuario_id = ? AND l.data BETWEEN ? AND ?
       GROUP BY c.id, c.nome, l.tipo
       ORDER BY total DESC, c.id ASC`,
      [usuarioId, inicio, fim],
    );
    return linhas.map((linha) => ({
      id: Number(linha.id), nome: linha.nome, tipo: linha.tipo, total: Number(linha.total),
    }));
  }

  async totaisPorFonteDestino(usuarioId, inicio, fim) {
    const sql = `
        SELECT
            fd.id,
            fd.nome,
            fd.tipo,
            COALESCE(SUM(
                CASE WHEN l.tipo = 'entrada'
                THEN l.valor ELSE 0 END
            ), 0) AS entradas,
            COALESCE(SUM(
                CASE WHEN l.tipo = 'saida'
                THEN l.valor ELSE 0 END
            ), 0) AS saidas
        FROM fontes_destinos fd
        LEFT JOIN lancamentos l
            ON l.fonte_destino_id = fd.id
            AND l.usuario_id = fd.usuario_id
            AND l.data BETWEEN ? AND ?
        WHERE fd.usuario_id = ?
        GROUP BY fd.id, fd.nome, fd.tipo
        ORDER BY fd.id ASC
    `;

    const [rows] = await pool.promise().execute(
        sql,
        [inicio, fim, usuarioId]
    );

    return rows.map(row => ({
        id: Number(row.id),
        nome: row.nome,
        tipo: row.tipo,
        entradas: Number(row.entradas),
        saidas: Number(row.saidas)
    }));
}
  }


module.exports = new Relatorio();
