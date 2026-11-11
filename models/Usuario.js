const pool = require('../database/connection');

const CATEGORIAS_PADRAO = [
  ['Salário', 'entrada'],
  ['Outras entradas', 'entrada'],
  ['Alimentação', 'saida'],
  ['Moradia', 'saida'],
  ['Saúde', 'saida'],
  ['Mobilidade', 'saida'],
  ['Lazer', 'saida'],
  ['Educação', 'saida'],
  ['Outras saídas', 'saida'],
];

class Usuario {
  async cadastrar({ nome, email, cpf, senhaHash }) {
    const connection = await pool.promise().getConnection();

    try {
      await connection.beginTransaction();
      const [resultado] = await connection.execute(
        'INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES (?, ?, ?, ?)',
        [nome, email, cpf, senhaHash],
      );
      const usuarioId = resultado.insertId;

      for (const [nomeCategoria, tipo] of CATEGORIAS_PADRAO) {
        await connection.execute(
          'INSERT INTO categorias (usuario_id, nome, tipo) VALUES (?, ?, ?)',
          [usuarioId, nomeCategoria, tipo],
        );
      }

      await connection.execute(
        'INSERT INTO fontes_destinos (usuario_id, nome, tipo) VALUES (?, ?, ?)',
        [usuarioId, 'Conta corrente', 'conta'],
      );
      await connection.commit();

      return { id: usuarioId, nome, email };
    } catch (error) {
      try {
        await connection.rollback();
      } catch {
        // Uma conexão cujo rollback falhou não deve ser reutilizada pelo pool.
        connection.destroy();
      }
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new Usuario();
