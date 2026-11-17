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

test('criação usa parâmetros SQL e retorna o identificador gerado pelo banco', async () => {
  const nome = "Categoria d'água";
  await simularConsulta(async (sql, parametros) => {
    assert.equal(sql, 'INSERT INTO categorias (usuario_id, nome, tipo) VALUES (?, ?, ?)');
    assert.deepEqual(parametros, [42, nome, 'saida']);
    return [{ insertId: 7 }];
  }, async () => {
    assert.deepEqual(await Categoria.criar({ nome, tipo: 'saida', usuarioId: 42 }), {
      id: 7, nome, tipo: 'saida',
    });
  });
});

test('criação repassa a violação UNIQUE para a rota tratar a duplicidade', async () => {
  const erro = Object.assign(new Error('Duplicidade simulada'), { code: 'ER_DUP_ENTRY' });
  await simularConsulta(async () => { throw erro; }, async () => {
    await assert.rejects(Categoria.criar({ nome: 'Lazer', tipo: 'saida', usuarioId: 42 }),
      (recebido) => recebido === erro);
  });
});

test('atualização filtra ID e proprietário e usa parâmetros separados', async () => {
  await simularConsulta(async (sql, parametros) => {
    assert.match(sql, /UPDATE categorias SET nome = \?, tipo = \? WHERE id = \? AND usuario_id = \?/);
    assert.deepEqual(parametros, ['Transporte', 'saida', 7, 42]);
    return [{ affectedRows: 1 }];
  }, async () => {
    assert.deepEqual(await Categoria.atualizar(7, { nome: 'Transporte', tipo: 'saida', usuarioId: 42 }), {
      id: 7, nome: 'Transporte', tipo: 'saida',
    });
  });
});

test('atualização sem registro pertencente ao usuário retorna null', async () => {
  await simularConsulta(async () => [{ affectedRows: 0 }], async () => {
    assert.equal(await Categoria.atualizar(7, { nome: 'Transporte', tipo: 'saida', usuarioId: 42 }), null);
  });
});

test('repetir os mesmos valores de uma categoria existente continua retornando sucesso', async () => {
  await simularConsulta(async () => [{ affectedRows: 1, changedRows: 0 }], async () => {
    assert.deepEqual(await Categoria.atualizar(7, { nome: 'Transporte', tipo: 'saida', usuarioId: 42 }), {
      id: 7, nome: 'Transporte', tipo: 'saida',
    });
  });
});
