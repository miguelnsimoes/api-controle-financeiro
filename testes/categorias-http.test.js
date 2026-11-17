const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const Categoria = require('../models/Categoria');

const segredoOriginal = process.env.JWT_SECRET;
const segredoTeste = 'segredo_ficticio_para_testar_categorias';
process.env.JWT_SECRET = segredoTeste;
const app = require('../server');
const listarOriginal = Categoria.listar;
let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/categorias`;
});

afterEach(() => { Categoria.listar = listarOriginal; });

after(async () => {
  if (segredoOriginal === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = segredoOriginal;
  await new Promise((resolve) => server.close(resolve));
});

async function listar(query = '', token) {
  const resposta = await fetch(baseUrl + query, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: resposta.status, dados: await resposta.json() };
}

function tokenUsuario(id) {
  return jwt.sign({ id }, segredoTeste, { expiresIn: '1h' });
}

test('GET /categorias exige JWT antes de consultar o model', async () => {
  Categoria.listar = async () => { assert.fail('Não deve consultar sem autenticação'); };
  for (const token of [undefined, 'token-invalido',
    jwt.sign({ id: 42 }, segredoTeste, { expiresIn: -1 })]) {
    assert.deepEqual(await listar('', token), {
      status: 401,
      dados: { erro: 'Token ausente, inválido ou expirado.' },
    });
  }
});

test('lista categorias de dois usuários usando o ID de cada token, ignorando a query de proprietário', async () => {
  const categorias = {
    42: [{ id: 1, nome: 'Salário A', tipo: 'entrada' }],
    99: [{ id: 2, nome: 'Moradia B', tipo: 'saida' }],
  };
  for (const id of [42, 99]) {
    Categoria.listar = async (usuarioId, tipo) => {
      assert.equal(usuarioId, id);
      assert.equal(tipo, undefined);
      return categorias[usuarioId];
    };
    const outroId = id === 42 ? 99 : 42;
    assert.deepEqual(await listar(`?usuario_id=${outroId}&id=${outroId}`, tokenUsuario(id)), {
      status: 200, dados: categorias[id],
    });
  }
});

test('encaminha filtros entrada e saida ao model mantendo o proprietário do token', async () => {
  for (const tipo of ['entrada', 'saida']) {
    Categoria.listar = async (usuarioId, filtro) => {
      assert.equal(usuarioId, 42);
      assert.equal(filtro, tipo);
      return [{ id: 1, nome: 'Categoria', tipo: filtro }];
    };
    const resposta = await listar(`?tipo=${tipo}`, tokenUsuario(42));
    assert.equal(resposta.status, 200);
    assert.equal(resposta.dados[0].tipo, tipo);
  }
});

test('lista vazia retorna 200 com array vazio', async () => {
  Categoria.listar = async () => [];
  assert.deepEqual(await listar('', tokenUsuario(42)), { status: 200, dados: [] });
});

test('tipo inválido retorna 400 sem consultar o banco', async () => {
  Categoria.listar = async () => { assert.fail('Filtro inválido não deve chegar ao model'); };
  for (const query of ['?tipo=invalido', '?tipo=', '?tipo=ENTRADA', '?tipo=entrada&tipo=saida']) {
    assert.deepEqual(await listar(query, tokenUsuario(42)), {
      status: 400,
      dados: { erro: 'Dados inválidos.', campos: { tipo: 'O tipo deve ser entrada ou saida.' } },
    });
  }
});

test('falha do model retorna 500 sem expor detalhes do banco', async () => {
  Categoria.listar = async () => { throw new Error('Detalhe privado da consulta'); };
  assert.deepEqual(await listar('', tokenUsuario(42)), {
    status: 500, dados: { erro: 'Erro interno do servidor.' },
  });
});
