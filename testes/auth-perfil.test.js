const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const segredoOriginal = process.env.JWT_SECRET;
const segredoTeste = 'segredo_ficticio_para_testar_o_perfil';
process.env.JWT_SECRET = segredoTeste;
const auth = require('../routes/auth');
const buscarOriginal = Usuario.buscarPorId;
let server;
let url;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/auth', auth);
  app.use((error, req, res, next) => {
    if (error.name === 'UnauthorizedError') {
      return res.status(401).json({ erro: 'Token ausente, inválido ou expirado.' });
    }
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  });
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  url = `http://127.0.0.1:${server.address().port}/auth/me`;
});

after(async () => {
  Usuario.buscarPorId = buscarOriginal;
  if (segredoOriginal === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = segredoOriginal;
  await new Promise((resolve) => server.close(resolve));
});

async function perfil(token, query = '') {
  const resposta = await fetch(url + query, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: resposta.status, dados: await resposta.json() };
}

test('perfil bloqueia tokens ausentes, malformados, expirados, adulterados ou de outro algoritmo', async () => {
  Usuario.buscarPorId = async () => { assert.fail('Token rejeitado não deve consultar o banco'); };
  const tokens = [
    null,
    'token-invalido',
    jwt.sign({ id: 42 }, segredoTeste, { expiresIn: -1 }),
    jwt.sign({ id: 42 }, 'outro_segredo', { expiresIn: '1h' }),
    jwt.sign({ id: 42 }, segredoTeste, { algorithm: 'HS384', expiresIn: '1h' }),
    jwt.sign({ id: 42 }, '', { algorithm: 'none' }),
  ];
  for (const token of tokens) {
    assert.deepEqual(await perfil(token), {
      status: 401,
      dados: { erro: 'Token ausente, inválido ou expirado.' },
    });
  }
});

test('perfil usa o ID do token e retorna somente os dados públicos atuais', async () => {
  const usuario = { id: 42, nome: 'Nome atual', email: 'atual@example.com' };
  Usuario.buscarPorId = async (id) => {
    assert.equal(id, 42);
    return { ...usuario, senha_hash: 'nao_deve_aparecer', cpf: '52998224725' };
  };
  const token = jwt.sign({ id: 42, nome: 'Nome antigo' }, segredoTeste, { expiresIn: '1h' });
  assert.deepEqual(await perfil(token, '?id=99&usuario_id=99'), { status: 200, dados: usuario });
});

test('perfil retorna 404 se o usuário do token não existe mais', async () => {
  Usuario.buscarPorId = async () => null;
  const token = jwt.sign({ id: 42 }, segredoTeste, { expiresIn: '1h' });
  assert.deepEqual(await perfil(token), { status: 404, dados: { erro: 'Usuário não encontrado.' } });
});

test('perfil encaminha erros de consulta sem expor detalhes internos', async () => {
  Usuario.buscarPorId = async () => { throw new Error('Detalhe privado do banco'); };
  const token = jwt.sign({ id: 42 }, segredoTeste, { expiresIn: '1h' });
  assert.deepEqual(await perfil(token), { status: 500, dados: { erro: 'Erro interno do servidor.' } });
});
