const pool = require('../database/connection');

class Categoria {
  async listar(usuarioId, tipo) {
    let sql = 'SELECT id, nome, tipo FROM categorias WHERE usuario_id = ?';
    const parametros = [usuarioId];

    if (tipo) {
      sql += ' AND tipo = ?';
      parametros.push(tipo);
    }

    const [categorias] = await pool.promise().execute(sql, parametros);
    return categorias;
  }
}

module.exports = new Categoria();
