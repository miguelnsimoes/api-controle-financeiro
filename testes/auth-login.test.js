const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const auth = require('../routes/auth');

const segredoTeste = 'segredo_ficticio_usado_somente_nos_testes';
const segredoOriginal = process.env.JWT_SECRET;
const buscarOriginal = Usuario.buscarPorEmail;
let server;
let url;
let senhaHash;

before(async () => {
  process.env.JWT_SECRET = segredoTeste;
  senhaHash = await bcrypt.hash('Exemplo123', 4);
  const app = express();
  app.use(express.json());
  app.use('/auth', auth);
  app.use((error, req, res, next) => {
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  });
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  url = `http://127.0.0.1:${server.address().port}/auth/login`;
});

after(async () => {
  Usuario.buscarPorEmail = buscarOriginal;
  if (segredoOriginal === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = segredoOriginal;
  await new Promise((resolve) => server.close(resolve));
});

async function login(dados) {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  return { status: resposta.status, dados: await resposta.json() };
}

test('login rejeita campos ausentes ou tipos incorretos antes de consultar o banco', async () => {
  Usuario.buscarPorEmail = async () => { assert.fail('Não deveria consultar o banco'); };
  for (const dados of [{}, { email: ' ', senha: 'Exemplo123' },
    { email: 42, senha: 'Exemplo123' }, { email: 'teste@example.com', senha: '' },
    { email: 'teste@example.com', senha: {} }]) {
    assert.equal((await login(dados)).status, 400);
  }
});

test('login responde o mesmo 401 para usuário inexistente e senha incorreta', async () => {
  Usuario.buscarPorEmail = async () => null;
  const inexistente = await login({ email: 'teste@example.com', senha: 'Exemplo123' });
  Usuario.buscarPorEmail = async () => ({ senha_hash: senhaHash });
  const senhaIncorreta = await login({ email: 'teste@example.com', senha: 'OutraSenha123' });
  assert.deepEqual(inexistente, { status: 401, dados: { erro: 'E-mail ou senha inválidos.' } });
  assert.deepEqual(senhaIncorreta, inexistente);
});

test('login válido retorna JWT assinado por uma hora e somente os dados públicos', async () => {
  const usuario = { id: 42, nome: 'Usuario de exemplo', email: 'teste@example.com' };
  Usuario.buscarPorEmail = async () => ({ ...usuario, senha_hash: senhaHash });
  const resposta = await login({ email: usuario.email, senha: 'Exemplo123' });
  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.dados.usuario, usuario);
  assert.deepEqual(Object.keys(resposta.dados).sort(), ['token', 'usuario']);
  const payload = jwt.verify(resposta.dados.token, segredoTeste, { algorithms: ['HS256'] });
  assert.deepEqual(payload, { ...usuario, iat: payload.iat, exp: payload.exp });
  assert.equal(payload.exp - payload.iat, 3600);
  assert.throws(() => jwt.verify(resposta.dados.token, 'outro_segredo_ficticio'));
});

test('falha na consulta não expõe detalhes do banco', async () => {
  Usuario.buscarPorEmail = async () => { throw new Error('Detalhe interno do banco'); };
  const resposta = await login({ email: 'teste@example.com', senha: 'Exemplo123' });
  assert.deepEqual(resposta, { status: 500, dados: { erro: 'Erro interno do servidor.' } });
});

test('sem JWT_SECRET, não retorna token nem sucesso', async () => {
  Usuario.buscarPorEmail = async () => ({ id: 42, nome: 'Teste', email: 'teste@example.com', senha_hash: senhaHash });
  delete process.env.JWT_SECRET;
  try {
    assert.equal((await login({ email: 'teste@example.com', senha: 'Exemplo123' })).status, 500);
  } finally {
    process.env.JWT_SECRET = segredoTeste;
  }
});
