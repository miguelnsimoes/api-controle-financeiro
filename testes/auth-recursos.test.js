const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const segredoOriginal = process.env.JWT_SECRET;
const segredoTeste = 'segredo_ficticio_para_testes_da_issue6';
process.env.JWT_SECRET = segredoTeste;
const app = require('../server');
const buscarOriginal = Usuario.buscarPorId;
const caminhosPrivados = ['/categorias', '/fontes-destinos', '/lancamentos', '/relatorios'];
let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  Usuario.buscarPorId = buscarOriginal;
  if (segredoOriginal === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = segredoOriginal;
  await new Promise((resolve) => server.close(resolve));
});

async function requisicao(caminho, metodo = 'GET', token) {
  const resposta = await fetch(baseUrl + caminho, {
    method: metodo,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  assert.ok(resposta.headers.get('content-type').includes('application/json'));
  return { status: resposta.status, dados: await resposta.json() };
}

test('caminhos financeiros exigem JWT em leitura, criação, alteração e exclusão', async () => {
  for (const caminho of caminhosPrivados) {
    for (const metodo of ['GET', 'POST', 'PUT', 'DELETE']) {
      const alvo = ['PUT', 'DELETE'].includes(metodo) ? `${caminho}/1` : caminho;
      assert.deepEqual(await requisicao(alvo, metodo), {
        status: 401,
        dados: { erro: 'Token ausente, inválido ou expirado.' },
      });
    }
  }
});

test('caminhos financeiros rejeitam tokens inválidos, expirados e com assinatura incorreta', async () => {
  const tokens = [
    'token-invalido',
    jwt.sign({ id: 42 }, segredoTeste, { expiresIn: -1 }),
    jwt.sign({ id: 42 }, 'segredo_incorreto', { expiresIn: '1h' }),
  ];
  for (const caminho of caminhosPrivados) {
    for (const token of tokens) {
      assert.equal((await requisicao(caminho, 'GET', token)).status, 401);
    }
  }
});

test('token válido não cria endpoints financeiros que ainda não existem', async () => {
  const token = jwt.sign({ id: 42 }, segredoTeste, { expiresIn: '1h' });
  for (const caminho of ['/lancamentos', '/relatorios']) {
    assert.deepEqual(await requisicao(caminho, 'GET', token), {
      status: 404,
      dados: { erro: 'Rota não encontrada.' },
    });
  }
});

test('fontes e destinos são listados pelo ID do token e pelo filtro opcional', async () => {
  const pool = require('../database/connection');
  const promiseOriginal = pool.promise;
  const contas = {
    42: [{ id: 1, nome: 'Conta A', tipo: 'conta', dia_fechamento: null, dia_vencimento: null, limite: null }],
    99: [{ id: 2, nome: 'Conta B', tipo: 'conta', dia_fechamento: null, dia_vencimento: null, limite: null }],
  };
  pool.promise = () => ({
    execute: async (sql, parametros) => {
      assert.match(sql, /FROM fontes_destinos WHERE usuario_id = \?/);
      assert.match(sql, /AND tipo = \?/);
      assert.equal(parametros[1], 'conta');
      return [contas[parametros[0]] || []];
    },
  });

  try {
    for (const id of [42, 99, 100]) {
      const token = jwt.sign({ id }, segredoTeste, { expiresIn: '1h' });
      assert.deepEqual(await requisicao('/fontes-destinos?tipo=conta&usuario_id=42', 'GET', token), {
        status: 200,
        dados: contas[id] || [],
      });
      assert.equal((await requisicao('/fontes-destinos?tipo=saida', 'GET', token)).status, 400);
    }
  } finally {
    pool.promise = promiseOriginal;
  }
});

test('cadastro e login continuam públicos', async () => {
  for (const caminho of ['/auth/cadastro', '/auth/login']) {
    // Sem corpo, as rotas respondem por campos ausentes, sem exigir JWT.
    assert.equal((await requisicao(caminho, 'POST')).status, 400);
  }
});

test('perfis de dois usuários seguem exclusivamente o ID do token', async () => {
  const usuarios = {
    42: { id: 42, nome: 'Usuario A', email: 'a@example.invalid' },
    99: { id: 99, nome: 'Usuario B', email: 'b@example.invalid' },
  };
  Usuario.buscarPorId = async (id) => usuarios[id] || null;
  for (const id of [42, 99]) {
    const outroId = id === 42 ? 99 : 42;
    const token = jwt.sign({ id }, segredoTeste, { expiresIn: '1h' });
    assert.deepEqual(await requisicao(`/auth/me?id=${outroId}&usuario_id=${outroId}`, 'GET', token), {
      status: 200,
      dados: usuarios[id],
    });
  }
});

test('rota inexistente retorna 404 em JSON', async () => {
  assert.deepEqual(await requisicao('/rota-inexistente'), {
    status: 404,
    dados: { erro: 'Rota não encontrada.' },
  });
});

test('JSON malformado continua retornando 400 na aplicação real', async () => {
  const resposta = await fetch(baseUrl + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(resposta.status, 400);
  assert.deepEqual(await resposta.json(), { erro: 'JSON inválido.' });
});
