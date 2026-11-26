
const pool = require('../database/connection');

class SaudeFinanceira {
  async buscarLancamentos(usuarioId, inicio) {
    const [linhas] = await pool.promise().execute(
      `SELECT
          l.id,
          l.tipo,
          l.valor,
          l.data,
          l.parcela_atual,
          l.total_parcelas,
          fd.tipo AS tipo_fonte,
          fd.dia_fechamento,
          fd.dia_vencimento
       FROM lancamentos l
       INNER JOIN fontes_destinos fd
          ON fd.id = l.fonte_destino_id
          AND fd.usuario_id = l.usuario_id
       WHERE l.usuario_id = ?
          AND l.data >= ?
       ORDER BY l.data ASC, l.id ASC`,
      [usuarioId, inicio]
    );

    return linhas.map((linha) => ({
      ...linha,
      valor: Number(linha.valor),
    }));
  }
}

module.exports = new SaudeFinanceira();
