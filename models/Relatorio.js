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
}

module.exports = new Relatorio();
