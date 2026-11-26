
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const SaudeFinanceira = require('../models/SaudeFinanceira');

const segredoOriginal = process.env.JWT_SECRET;
const segredoTeste = 'segredo_teste_saude_financeira';

process.env.JWT_SECRET = segredoTeste;

const app = require('../server');
const metodoOriginal = SaudeFinanceira.buscarLancamentos;

let server;
let baseUrl;

before(async () => {
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}/saude-financeira`;
});

afterEach(() => {
  SaudeFinanceira.buscarLancamentos = metodoOriginal;
});

after(async () => {
  if (segredoOriginal === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = segredoOriginal;
  }

  await new Promise(resolve => server.close(resolve));
});

function token(id = 42, segredo = segredoTeste, expira = '1h') {
  return jwt.sign({ id }, segredo, { expiresIn: expira });
}

async function consultar(query = '', auth) {
  const resposta = await fetch(`${baseUrl}${query}`, {
    headers: auth ? { Authorization: `Bearer ${auth}` } : {},
  });

  return {
    status: resposta.status,
    dados: await resposta.json(),
  };
}

function lancamento(tipo, valor) {
  return {
    tipo,
    valor,
    data: new Date().toISOString().slice(0, 10),
    tipo_fonte: 'conta',
    parcela_atual: 1,
    total_parcelas: 1,
  };
}

test('rejeita JWT ausente, invalido ou expirado', async () => {
  SaudeFinanceira.buscarLancamentos = async () => {
    assert.fail('Nao deve consultar sem autenticacao');
  };

  for (const auth of [
    undefined,
    'invalido',
    token(42, 'outra_chave'),
    token(42, segredoTeste, -1),
  ]) {
    const resposta = await consultar('', auth);

    assert.equal(resposta.status, 401);
  }
});

test('retorna indicadores, projecao, dicas e aviso', async () => {
  SaudeFinanceira.buscarLancamentos = async () => [
    lancamento('entrada', 5000),
    lancamento('saida', 3500),
  ];

  const resposta = await consultar('', token());

  assert.equal(resposta.status, 200);
  assert.equal(resposta.dados.indicadores.taxaPoupanca, 0.3);

  assert.ok(
    Object.keys(resposta.dados.indicadores).length >= 3
  );

  assert.equal(resposta.dados.projecao.length, 6);
  assert.ok(resposta.dados.dicas.length > 0);

  assert.equal(
    resposta.dados.aviso,
    'Informações educativas; não constituem recomendação financeira profissional.'
  );
});

test('retorna resposta valida quando nao existem lancamentos', async () => {
  SaudeFinanceira.buscarLancamentos = async () => [];

  const resposta = await consultar('', token());

  assert.equal(resposta.status, 200);
  assert.equal(resposta.dados.indicadores.taxaPoupanca, null);
  assert.equal(resposta.dados.indicadores.comprometimentoCartoes, null);
  assert.equal(resposta.dados.indicadores.totalParcelasFuturas, 0);
  assert.deepEqual(resposta.dados.indicadores.parcelasPorMes, []);
  assert.equal(resposta.dados.projecao.length, 6);
});

test('utiliza exclusivamente o ID do usuario autenticado', async () => {
  const chamadas = [];

  SaudeFinanceira.buscarLancamentos = async (usuarioId, inicio) => {
    chamadas.push(usuarioId);

    assert.match(inicio, /^\d{4}-\d{2}-01$/);

    return [
      lancamento('entrada', 1000),
      lancamento('saida', usuarioId === 42 ? 200 : 800),
    ];
  };

  const usuario42 = await consultar(
    '?usuario_id=99&usuarioId=99',
    token(42)
  );

  const usuario99 = await consultar(
    '?usuario_id=42&usuarioId=42',
    token(99)
  );

  assert.equal(usuario42.status, 200);
  assert.equal(usuario99.status, 200);

  assert.equal(usuario42.dados.indicadores.taxaPoupanca, 0.8);
  assert.equal(usuario99.dados.indicadores.taxaPoupanca, 0.2);

  assert.deepEqual(chamadas, [42, 99]);
});

test('retorna valores monetarios numericos', async () => {
  SaudeFinanceira.buscarLancamentos = async () => [];

  const resposta = await consultar('', token());

  assert.equal(resposta.status, 200);

  for (const mes of resposta.dados.projecao) {
    assert.equal(typeof mes.entradas, 'number');
    assert.equal(typeof mes.saidas, 'number');
    assert.equal(typeof mes.parcelas, 'number');
    assert.equal(typeof mes.saldoPrevisto, 'number');
  }
});

test('falha do model retorna erro 500 sem expor SQL', async () => {
  const originalConsole = console.error;
  console.error = () => {};

  try {
    SaudeFinanceira.buscarLancamentos = async () => {
      throw new Error('SQL sensivel');
    };

    const resposta = await consultar('', token());

    assert.deepEqual(resposta, {
      status: 500,
      dados: { erro: 'Erro interno do servidor.' },
    });
  } finally {
    console.error = originalConsole;
  }
});
