const pool = require('../database/connection');

class FonteDestino {
  async atualizar(id, { usuarioId, nome, tipo, diaFechamento, diaVencimento, limite }) {
    const [resultado] = await pool.promise().execute(
      `UPDATE fontes_destinos
       SET nome = ?, tipo = ?, dia_fechamento = ?, dia_vencimento = ?, limite = ?
       WHERE id = ? AND usuario_id = ?`,
      [nome, tipo, diaFechamento, diaVencimento, limite, id, usuarioId],
    );
    if (resultado.affectedRows === 0) {
      return null;
    }

    return {
      id,
      nome,
      tipo,
      dia_fechamento: diaFechamento,
      dia_vencimento: diaVencimento,
      limite,
    };
  }

  async criar({ usuarioId, nome, tipo, diaFechamento, diaVencimento, limite }) {
    const [resultado] = await pool.promise().execute(
      `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [usuarioId, nome, tipo, diaFechamento, diaVencimento, limite],
    );

    return {
      id: resultado.insertId,
      nome,
      tipo,
      dia_fechamento: diaFechamento,
      dia_vencimento: diaVencimento,
      limite,
    };
  }

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
