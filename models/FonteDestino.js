const pool = require('../database/connection');

class FonteDestino {
  async listar(usuarioId, tipo) {
    let sql = `SELECT id, nome, tipo, dia_fechamento, dia_vencimento, limite
      FROM fontes_destinos WHERE usuario_id = ?`;
    const parametros = [usuarioId];

    if (tipo) {
      sql += ' AND tipo = ?';
      parametros.push(tipo);
    }

    const [fontesDestinos] = await pool.promise().execute(sql, parametros);
    return fontesDestinos;
  }
}

module.exports = new FonteDestino();
