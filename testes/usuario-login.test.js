const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../database/connection');
const Usuario = require('../models/Usuario');

async function simularConsulta(execute, verificar) {
  const promiseOriginal = pool.promise;
  pool.promise = () => ({ execute });
  try {
    await verificar();
  } finally {
    pool.promise = promiseOriginal;
  }
}

test('busca pelo e-mail normalizado, usando parâmetro SQL', async () => {
  const usuario = {
    id: 42,
    nome: 'Usuario de exemplo',
    email: 'usuario@example.com',
    senha_hash: 'hash_ficticio',
  };

  await simularConsulta(async (sql, parametros) => {
    assert.equal(sql, 'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?');
    assert.deepEqual(parametros, ['usuario@example.com']);
    return [[usuario]];
  }, async () => {
    assert.deepEqual(await Usuario.buscarPorEmail('  USUARIO@EXAMPLE.COM  '), usuario);
  });
});

test('retorna null quando o e-mail não existe', async () => {
  await simularConsulta(async () => [[]], async () => {
    assert.equal(await Usuario.buscarPorEmail('ausente@example.com'), null);
  });
});

test('repassa falhas do banco para quem chamou o método', async () => {
  const erro = new Error('Falha simulada no banco');
  await simularConsulta(async () => { throw erro; }, async () => {
    await assert.rejects(Usuario.buscarPorEmail('usuario@example.com'), (recebido) => recebido === erro);
  });
});
