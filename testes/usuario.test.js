const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../database/connection');
const Usuario = require('../models/Usuario');

const dados = {
  nome: 'Usuário de teste',
  email: 'teste@example.invalid',
  cpf: '52998224725',
  senhaHash: 'hash_ficticio_para_teste_unitario',
};

async function simularTransacao(falharEm, verificar) {
  const chamadas = [];
  const erro = new Error('Falha simulada');
  const connection = {
    async beginTransaction() { chamadas.push('begin'); },
    async execute(sql, parametros) {
      chamadas.push({ sql, parametros });
      if (falharEm && sql.includes(falharEm)) throw erro;
      return [{ insertId: 42 }];
    },
    async commit() { chamadas.push('commit'); },
    async rollback() { chamadas.push('rollback'); },
    release() { chamadas.push('release'); },
  };
  const promiseOriginal = pool.promise;
  pool.promise = () => ({ async getConnection() { return connection; } });
  try {
    await verificar(chamadas, erro);
  } finally {
    pool.promise = promiseOriginal;
  }
}

test('cadastro confirma os dados padrão juntos e não retorna CPF ou hash', async () => {
  await simularTransacao(null, async (chamadas) => {
    const resultado = await Usuario.cadastrar(dados);
    assert.deepEqual(resultado, { id: 42, nome: dados.nome, email: dados.email });
    const insercoes = chamadas.filter((chamada) => typeof chamada === 'object');
    const categorias = insercoes.filter(({ sql }) => sql.includes('INSERT INTO categorias'));
    assert.equal(categorias.length, 9);
    assert.equal(categorias.filter(({ parametros }) => parametros[2] === 'entrada').length, 2);
    assert.equal(categorias.filter(({ parametros }) => parametros[2] === 'saida').length, 7);
    assert.ok(categorias.every(({ parametros }) => parametros[0] === 42));
    assert.deepEqual(insercoes.at(-1).parametros, [42, 'Conta corrente', 'conta']);
    assert.deepEqual(chamadas.slice(-2), ['commit', 'release']);
    assert.ok(!chamadas.includes('rollback'));
  });
});

for (const tabela of ['usuarios', 'categorias', 'fontes_destinos']) {
  test(`falha em ${tabela} desfaz a transação e libera a conexão`, async () => {
    await simularTransacao(`INSERT INTO ${tabela}`, async (chamadas, erro) => {
      await assert.rejects(Usuario.cadastrar(dados), (recebido) => recebido === erro);
      assert.ok(!chamadas.includes('commit'));
      assert.deepEqual(chamadas.slice(-2), ['rollback', 'release']);
    });
  });
}
