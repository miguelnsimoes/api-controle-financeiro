const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const Categoria = require('../models/Categoria');

const segredoOriginal = process.env.JWT_SECRET;
const segredoTeste = 'segredo_ficticio_para_testar_categorias';
process.env.JWT_SECRET = segredoTeste;
const app = require('../server');
const listarOriginal = Categoria.listar;
const criarOriginal = Categoria.criar;
const atualizarOriginal = Categoria.atualizar;
const excluirOriginal = Categoria.excluir;
let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/categorias`;
});

afterEach(() => {
  Categoria.listar = listarOriginal;
  Categoria.criar = criarOriginal;
  Categoria.atualizar = atualizarOriginal;
  Categoria.excluir = excluirOriginal;
});

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

async function criar(dados, token) {
  const resposta = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(dados),
  });
  return { status: resposta.status, dados: await resposta.json() };
}

test('POST /categorias exige JWT antes de gravar', async () => {
  Categoria.criar = async () => { assert.fail('Não deve gravar sem autenticação'); };
  for (const token of [undefined, 'token-invalido',
    jwt.sign({ id: 42 }, segredoTeste, { expiresIn: -1 })]) {
    assert.equal((await criar({ nome: 'Lazer', tipo: 'saida' }, token)).status, 401);
  }
});

test('criação valida campos obrigatórios e tipos antes de chamar o model', async () => {
  Categoria.criar = async () => { assert.fail('Dados inválidos não devem chegar ao model'); };
  for (const dados of [{}, [], { nome: ' ', tipo: 'saida' },
    { nome: 42, tipo: 'entrada' }, { nome: 'Lazer', tipo: 'invalido' },
    { nome: 'Lazer', tipo: ['saida'] }]) {
    const resposta = await criar(dados, tokenUsuario(42));
    assert.equal(resposta.status, 400);
    assert.equal(resposta.dados.erro, 'Dados inválidos.');
    assert.ok(Object.keys(resposta.dados.campos).length > 0);
  }
  assert.deepEqual(await criar(null, tokenUsuario(42)), {
    status: 400, dados: { erro: 'JSON inválido.' },
  });
});

test('cria categorias de entrada e saída com nome aparado e proprietário do token', async () => {
  for (const [id, tipo] of [[42, 'entrada'], [99, 'saida']]) {
    Categoria.criar = async (dados) => {
      assert.deepEqual(dados, { nome: 'Categoria', tipo, usuarioId: id });
      return { id: 7, nome: dados.nome, tipo: dados.tipo };
    };
    assert.deepEqual(await criar({ nome: '  Categoria  ', tipo, usuario_id: 123, usuarioId: 123 }, tokenUsuario(id)), {
      status: 201, dados: { id: 7, nome: 'Categoria', tipo },
    });
  }
});

test('nome duplicado para o mesmo usuário e tipo retorna 409', async () => {
  Categoria.criar = async () => { throw Object.assign(new Error('Duplicidade'), { code: 'ER_DUP_ENTRY' }); };
  assert.deepEqual(await criar({ nome: 'Lazer', tipo: 'saida' }, tokenUsuario(42)), {
    status: 409,
    dados: {
      erro: 'Categoria já cadastrada.',
      campos: { nome: 'Já existe uma categoria com este nome e tipo.' },
    },
  });
});

test('falha inesperada na criação retorna 500 sem detalhes do banco', async () => {
  Categoria.criar = async () => { throw new Error('Detalhe privado da inserção'); };
  assert.deepEqual(await criar({ nome: 'Lazer', tipo: 'saida' }, tokenUsuario(42)), {
    status: 500, dados: { erro: 'Erro interno do servidor.' },
  });
});

async function atualizar(id, dados, token) {
  const resposta = await fetch(`${baseUrl}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(dados),
  });
  return { status: resposta.status, dados: await resposta.json() };
}

test('PUT /categorias/:id exige JWT antes de atualizar', async () => {
  Categoria.atualizar = async () => { assert.fail('Não deve atualizar sem autenticação'); };
  for (const token of [undefined, 'token-invalido',
    jwt.sign({ id: 42 }, segredoTeste, { expiresIn: -1 })]) {
    assert.equal((await atualizar(7, { nome: 'Lazer', tipo: 'saida' }, token)).status, 401);
  }
});

test('atualização rejeita ID, nome e tipo inválidos antes de consultar o model', async () => {
  Categoria.atualizar = async () => { assert.fail('Dados inválidos não devem chegar ao model'); };
  const casos = [
    ['abc', { nome: 'Lazer', tipo: 'saida' }],
    [0, { nome: 'Lazer', tipo: 'saida' }],
    [-1, { nome: 'Lazer', tipo: 'saida' }],
    [7, {}],
    [7, { nome: ' ', tipo: 'saida' }],
    [7, { nome: 42, tipo: 'saida' }],
    [7, { nome: 'Lazer', tipo: 'invalido' }],
  ];
  for (const [id, dados] of casos) {
    const resposta = await atualizar(id, dados, tokenUsuario(42));
    assert.equal(resposta.status, 400);
    assert.equal(resposta.dados.erro, 'Dados inválidos.');
  }
});

test('atualiza pelo ID da URL com nome aparado e proprietário obtido do token', async () => {
  Categoria.atualizar = async (id, dados) => {
    assert.equal(id, 7);
    assert.deepEqual(dados, { nome: 'Transporte', tipo: 'saida', usuarioId: 42 });
    return { id, nome: dados.nome, tipo: dados.tipo };
  };
  assert.deepEqual(await atualizar('7?usuario_id=99', {
    nome: '  Transporte  ', tipo: 'saida', usuario_id: 99, usuarioId: 99,
  }, tokenUsuario(42)), {
    status: 200, dados: { id: 7, nome: 'Transporte', tipo: 'saida' },
  });
});

test('categoria inexistente ou de outro usuário retorna o mesmo 404', async () => {
  Categoria.atualizar = async () => null;
  for (const id of [7, 999]) {
    assert.deepEqual(await atualizar(id, { nome: 'Lazer', tipo: 'saida' }, tokenUsuario(42)), {
      status: 404, dados: { erro: 'Categoria não encontrada.' },
    });
  }
});

test('atualização que gera duplicidade retorna 409', async () => {
  Categoria.atualizar = async () => { throw Object.assign(new Error('Duplicidade'), { code: 'ER_DUP_ENTRY' }); };
  assert.deepEqual(await atualizar(7, { nome: 'Lazer', tipo: 'saida' }, tokenUsuario(42)), {
    status: 409,
    dados: {
      erro: 'Categoria já cadastrada.',
      campos: { nome: 'Já existe uma categoria com este nome e tipo.' },
    },
  });
});

test('erro inesperado na atualização retorna 500 com mensagem genérica', async () => {
  Categoria.atualizar = async () => { throw new Error('Detalhe privado do UPDATE'); };
  assert.deepEqual(await atualizar(7, { nome: 'Lazer', tipo: 'saida' }, tokenUsuario(42)), {
    status: 500, dados: { erro: 'Erro interno do servidor.' },
  });
});

async function excluir(id, token, dados) {
  const resposta = await fetch(`${baseUrl}/${id}`, {
    method: 'DELETE',
    headers: {
      ...(dados !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: dados !== undefined ? JSON.stringify(dados) : undefined,
  });
  const corpo = await resposta.text();
  return { status: resposta.status, corpo, dados: corpo ? JSON.parse(corpo) : null };
}

test('DELETE /categorias/:id exige JWT antes de excluir', async () => {
  Categoria.excluir = async () => { assert.fail('Não deve excluir sem autenticação'); };
  for (const token of [undefined, 'token-invalido',
    jwt.sign({ id: 42 }, segredoTeste, { expiresIn: -1 })]) {
    assert.equal((await excluir(7, token)).status, 401);
  }
});

test('exclusão rejeita identificador inválido antes de consultar o model', async () => {
  Categoria.excluir = async () => { assert.fail('ID inválido não deve chegar ao model'); };
  for (const id of ['abc', 0, -1]) {
    const resposta = await excluir(id, tokenUsuario(42));
    assert.equal(resposta.status, 400);
    assert.equal(resposta.dados.campos.id, 'Informe um identificador válido.');
  }
});

test('exclusão usa o proprietário do token e retorna 204 sem corpo', async () => {
  Categoria.excluir = async (id, usuarioId) => {
    assert.equal(id, 7);
    assert.equal(usuarioId, 42);
    return true;
  };
  const resposta = await excluir('7?usuario_id=99', tokenUsuario(42), { usuario_id: 99, usuarioId: 99 });
  assert.equal(resposta.status, 204);
  assert.equal(resposta.corpo, '');
  assert.equal(resposta.dados, null);
});

test('exclusão de categoria inexistente ou de outro usuário retorna o mesmo 404', async () => {
  Categoria.excluir = async () => false;
  for (const id of [7, 999]) {
    const resposta = await excluir(id, tokenUsuario(42));
    assert.equal(resposta.status, 404);
    assert.deepEqual(resposta.dados, { erro: 'Categoria não encontrada.' });
  }
});

test('exclusão de categoria vinculada a lançamentos retorna 409', async () => {
  Categoria.excluir = async () => { throw Object.assign(new Error('Restrição'), { code: 'ER_ROW_IS_REFERENCED_2' }); };
  const resposta = await excluir(7, tokenUsuario(42));
  assert.equal(resposta.status, 409);
  assert.deepEqual(resposta.dados, { erro: 'Não é possível excluir uma categoria com lançamentos vinculados.' });
});

test('erro inesperado na exclusão retorna 500 sem detalhes internos', async () => {
  Categoria.excluir = async () => { throw new Error('Detalhe privado do DELETE'); };
  const resposta = await excluir(7, tokenUsuario(42));
  assert.equal(resposta.status, 500);
  assert.deepEqual(resposta.dados, { erro: 'Erro interno do servidor.' });
});
