const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../database/connection');
const Categoria = require('../models/Categoria');

async function simularConsulta(execute, verificar) {
  const promiseOriginal = pool.promise;
  pool.promise = () => ({ execute });
  try {
    await verificar();
  } finally {
    pool.promise = promiseOriginal;
  }
}

test('listagem restringe a consulta ao proprietário por parâmetro SQL', async () => {
  const categorias = [{ id: 1, nome: 'Salário', tipo: 'entrada' }];
  await simularConsulta(async (sql, parametros) => {
    assert.match(sql, /WHERE usuario_id = \?/);
    assert.deepEqual(parametros, [42]);
    return [categorias];
  }, async () => {
    assert.deepEqual(await Categoria.listar(42), categorias);
  });
});

test('filtro de tipo mantém a restrição ao proprietário', async () => {
  for (const tipo of ['entrada', 'saida']) {
    await simularConsulta(async (sql, parametros) => {
      assert.match(sql, /WHERE usuario_id = \? AND tipo = \?/);
      assert.deepEqual(parametros, [42, tipo]);
      return [[]];
    }, async () => {
      assert.deepEqual(await Categoria.listar(42, tipo), []);
    });
  }
});

test('valor do filtro é passado separadamente e não incorporado ao SQL', async () => {
  const filtro = "saida' OR 1=1 --";
  await simularConsulta(async (sql, parametros) => {
    assert.ok(!sql.includes(filtro));
    assert.deepEqual(parametros, [42, filtro]);
    return [[]];
  }, async () => {
    assert.deepEqual(await Categoria.listar(42, filtro), []);
  });
});

test('falhas na consulta são repassadas a quem chamou o model', async () => {
  const erro = new Error('Falha simulada');
  await simularConsulta(async () => { throw erro; }, async () => {
    await assert.rejects(Categoria.listar(42), (recebido) => recebido === erro);
  });
});
