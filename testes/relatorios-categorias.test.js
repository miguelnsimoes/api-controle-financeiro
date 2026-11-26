const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const Relatorio = require('../models/Relatorio');

const segredoOriginal = process.env.JWT_SECRET;
const segredoTeste = 'segredo_ficticio_para_testar_relatorio_categorias';
process.env.JWT_SECRET = segredoTeste;
const app = require('../server');
const metodoOriginal = Relatorio.totaisPorCategoria;
let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/relatorios/categorias`;
});

afterEach(() => { Relatorio.totaisPorCategoria = metodoOriginal; });

after(async () => {
  if (segredoOriginal === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = segredoOriginal;
  await new Promise((resolve) => server.close(resolve));
});

function token(id = 42, segredo = segredoTeste, expira = '1h') {
  return jwt.sign({ id }, segredo, { expiresIn: expira });
}

async function consultar(query = '', auth) {
  const resposta = await fetch(`${baseUrl}${query}`, {
    headers: auth ? { Authorization: `Bearer ${auth}` } : {},
  });
  return { status: resposta.status, dados: await resposta.json() };
}

const periodo = '?inicio=2026-10-01&fim=2026-10-31';

test('JWT ausente, inválido, expirado ou com outra assinatura retorna 401 sem consultar o model', async () => {
  Relatorio.totaisPorCategoria = async () => { assert.fail('Não consultar sem JWT válido'); };
  for (const auth of [undefined, 'invalido', token(42, 'outra_chave'), token(42, segredoTeste, -1)]) {
    assert.deepEqual(await consultar(periodo, auth), {
      status: 401, dados: { erro: 'Token ausente, inválido ou expirado.' },
    });
  }
});

test('datas obrigatórias e calendários inválidos retornam 400 sem consultar o model', async () => {
  Relatorio.totaisPorCategoria = async () => { assert.fail('Data inválida não deve chegar ao SQL'); };
  for (const query of [
    '', '?inicio=2026-10-01', '?fim=2026-10-31',
    '?inicio=2026-02-29&fim=2026-03-01',
    '?inicio=2026-02-30&fim=2026-03-01',
    '?inicio=2026-00-01&fim=2026-10-01',
    '?inicio=2026-10-01&fim=2026-13-01',
    '?inicio=2026-10-31&fim=2026-10-01',
    '?inicio=2026-10-01&inicio=2026-10-02&fim=2026-10-31',
    '?inicio=2026-10-01&fim=2026-10-31&fim=2026-11-30',
    '?inicio=26-10-01&fim=2026-10-31',
    '?inicio=0999-12-31&fim=1000-01-02',
    '?inicio=1000-01-01&fim=1000-01-01',
  ]) {
    const resposta = await consultar(query, token());
    assert.equal(resposta.status, 400, query);
    assert.equal(resposta.dados.erro, 'Dados inválidos.');
    assert.ok(Object.keys(resposta.dados.campos).length > 0, query);
  }
});

test('percentuais, totais, ordem decrescente e comparação com intervalo de mesma duração', async () => {
  const chamadas = [];
  Relatorio.totaisPorCategoria = async (usuarioId, inicio, fim) => {
    chamadas.push({ usuarioId, inicio, fim });
    if (inicio === '2026-10-01') return [
      { id: 2, nome: 'Alimentação', tipo: 'saida', total: 100.5 },
      { id: 3, nome: 'Moradia', tipo: 'saida', total: 300 },
      { id: 1, nome: 'Salário', tipo: 'entrada', total: 1000 },
    ];
    return [
      { id: 2, nome: 'Alimentação', tipo: 'saida', total: 80 },
      { id: 1, nome: 'Salário', tipo: 'entrada', total: 900 },
    ];
  };
  const resposta = await consultar(`${periodo}&usuario_id=99`, token(42));
  assert.equal(resposta.status, 200);
  assert.deepEqual(chamadas, [
    { usuarioId: 42, inicio: '2026-10-01', fim: '2026-10-31' },
    { usuarioId: 42, inicio: '2026-08-31', fim: '2026-09-30' },
  ]);
  assert.deepEqual(resposta.dados.periodoAnterior, { inicio: '2026-08-31', fim: '2026-09-30' });
  assert.deepEqual(resposta.dados.saidas, {
    total: 400.5,
    categorias: [
      { id: 3, nome: 'Moradia', total: 300, percentual: 74.91, anterior: 0, variacao: null },
      { id: 2, nome: 'Alimentação', total: 100.5, percentual: 25.09, anterior: 80, variacao: 25.63 },
    ],
  });
  assert.deepEqual(resposta.dados.entradas, {
    total: 1000,
    categorias: [{ id: 1, nome: 'Salário', total: 1000, percentual: 100, anterior: 900, variacao: 11.11 }],
  });
});

test('período de um dia compara com o dia anterior', async () => {
  const chamadas = [];
  Relatorio.totaisPorCategoria = async (...args) => { chamadas.push(args); return []; };
  const resposta = await consultar('?inicio=2026-01-01&fim=2026-01-01', token());
  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.dados.periodoAnterior, { inicio: '2025-12-31', fim: '2025-12-31' });
  assert.deepEqual(chamadas.map(([, inicio, fim]) => [inicio, fim]), [
    ['2026-01-01', '2026-01-01'], ['2025-12-31', '2025-12-31'],
  ]);
});

test('29 de fevereiro de ano bissexto é aceito e comparado corretamente', async () => {
  Relatorio.totaisPorCategoria = async () => [];
  const resposta = await consultar('?inicio=2024-02-28&fim=2024-03-01', token());
  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.dados.periodoAnterior, { inicio: '2024-02-25', fim: '2024-02-27' });
});

test('sem lançamentos retorna totais numéricos zero e listas vazias', async () => {
  Relatorio.totaisPorCategoria = async () => [];
  const resposta = await consultar(periodo, token(99));
  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.dados.saidas, { total: 0, categorias: [] });
  assert.deepEqual(resposta.dados.entradas, { total: 0, categorias: [] });
});

test('dois usuários obtêm somente seus dados por ID vindo do token', async () => {
  Relatorio.totaisPorCategoria = async (usuarioId, inicio) => inicio === '2026-10-01'
    ? [{ id: usuarioId, nome: 'Categoria', tipo: 'saida', total: usuarioId }]
    : [];
  for (const id of [42, 99]) {
    const resposta = await consultar(`${periodo}&usuario_id=${id === 42 ? 99 : 42}`, token(id));
    assert.equal(resposta.status, 200);
    assert.equal(resposta.dados.saidas.categorias[0].id, id);
    assert.equal(resposta.dados.saidas.total, id);
  }
});

test('falha do model retorna erro genérico sem expor o SQL', async () => {
  const originalConsole = console.error;
  console.error = () => {};
  try {
    Relatorio.totaisPorCategoria = async () => { throw new Error('SQL sensível'); };
    assert.deepEqual(await consultar(periodo, token()), {
      status: 500, dados: { erro: 'Erro interno do servidor.' },
    });
  } finally {
    console.error = originalConsole;
  }
});
