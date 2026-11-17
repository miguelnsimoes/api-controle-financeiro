const pool = require('../database/connection');

class Categoria {
  async atualizar(id, { nome, tipo, usuarioId }) {
    const [resultado] = await pool.promise().execute(
      'UPDATE categorias SET nome = ?, tipo = ? WHERE id = ? AND usuario_id = ?',
      [nome, tipo, id, usuarioId],
    );

    if (resultado.affectedRows === 0) {
      return null;
    }
    return { id, nome, tipo };
  }

  async criar({ nome, tipo, usuarioId }) {
    const [resultado] = await pool.promise().execute(
      'INSERT INTO categorias (usuario_id, nome, tipo) VALUES (?, ?, ?)',
      [usuarioId, nome, tipo],
    );

    return { id: resultado.insertId, nome, tipo };
  }

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
