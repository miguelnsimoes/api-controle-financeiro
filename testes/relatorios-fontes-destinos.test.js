const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const Relatorio = require('../models/Relatorio');

const segredoOriginal = process.env.JWT_SECRET;
const segredoTeste = 'segredo_teste_fontes_destinos';

process.env.JWT_SECRET = segredoTeste;

const app = require('../server');
const metodoOriginal = Relatorio.totaisPorFonteDestino;

let server;
let baseUrl;

before(async () => {
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}/relatorios/fontes-destinos`;
});

afterEach(() => {
  Relatorio.totaisPorFonteDestino = metodoOriginal;
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

const periodo = '?inicio=2026-10-01&fim=2026-10-31';

test('rejeita JWT ausente ou invalido', async () => {
  Relatorio.totaisPorFonteDestino = async () => {
    assert.fail('Nao deve consultar sem autenticacao');
  };

  for (const auth of [
    undefined,
    'invalido',
    token(42, 'outra_chave'),
    token(42, segredoTeste, -1),
  ]) {
    const resposta = await consultar(periodo, auth);
    assert.equal(resposta.status, 401);
  }
});

test('rejeita datas ausentes ou invalidas', async () => {
  Relatorio.totaisPorFonteDestino = async () => {
    assert.fail('Nao deve consultar com datas invalidas');
  };

  for (const query of [
    '',
    '?inicio=2026-10-01',
    '?fim=2026-10-31',
    '?inicio=2026-02-30&fim=2026-03-01',
    '?inicio=2026-10-31&fim=2026-10-01',
    '?inicio=2026-13-01&fim=2026-10-31',
    '?inicio=26-10-01&fim=2026-10-31',
    '?inicio=2026-10-01&inicio=2026-10-02&fim=2026-10-31',
  ]) {
    const resposta = await consultar(query, token());
    assert.equal(resposta.status, 400, query);
    assert.ok(Object.keys(resposta.dados.campos).length > 0);
  }
});

test('retorna entradas, saidas e saldos corretamente', async () => {
  const chamadas = [];

  Relatorio.totaisPorFonteDestino = async (...args) => {
    chamadas.push(args);

    return [
      {
        id: 1,
        nome: 'Conta corrente',
        tipo: 'conta',
        entradas: 1500,
        saidas: 500.5,
      },
      {
        id: 2,
        nome: 'Carteira',
        tipo: 'conta',
        entradas: 200,
        saidas: 350,
      },
      {
        id: 3,
        nome: 'Poupanca',
        tipo: 'conta',
        entradas: 0,
        saidas: 0,
      },
    ];
  };

  const resposta = await consultar(periodo, token());

  assert.equal(resposta.status, 200);

  assert.deepEqual(chamadas, [
    [42, '2026-10-01', '2026-10-31'],
  ]);

  assert.deepEqual(resposta.dados.periodo, {
    inicio: '2026-10-01',
    fim: '2026-10-31',
  });

  assert.deepEqual(resposta.dados.entradas, [
    { id: 1, nome: 'Conta corrente', tipo: 'conta', total: 1500 },
    { id: 2, nome: 'Carteira', tipo: 'conta', total: 200 },
  ]);

  assert.deepEqual(resposta.dados.saidas, [
    { id: 1, nome: 'Conta corrente', tipo: 'conta', total: 500.5 },
    { id: 2, nome: 'Carteira', tipo: 'conta', total: 350 },
  ]);

  assert.deepEqual(resposta.dados.contas, [
    {
      id: 1,
      nome: 'Conta corrente',
      entradas: 1500,
      saidas: 500.5,
      saldo: 999.5,
    },
    {
      id: 2,
      nome: 'Carteira',
      entradas: 200,
      saidas: 350,
      saldo: -150,
    },
    {
      id: 3,
      nome: 'Poupanca',
      entradas: 0,
      saidas: 0,
      saldo: 0,
    },
  ]);
});

test('aceita datas de ano bissexto', async () => {
  Relatorio.totaisPorFonteDestino = async () => [];

  const resposta = await consultar(
    '?inicio=2024-02-29&fim=2024-02-29',
    token()
  );

  assert.equal(resposta.status, 200);
});

test('retorna listas vazias quando nao existem registros', async () => {
  Relatorio.totaisPorFonteDestino = async () => [];

  const resposta = await consultar(periodo, token());

  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.dados.entradas, []);
  assert.deepEqual(resposta.dados.saidas, []);
  assert.deepEqual(resposta.dados.contas, []);
});

test('utiliza exclusivamente o ID do usuario autenticado', async () => {
  Relatorio.totaisPorFonteDestino = async usuarioId => [
    {
      id: usuarioId,
      nome: 'Conta',
      tipo: 'conta',
      entradas: 100,
      saidas: 50,
    },
  ];

  for (const id of [42, 99]) {
    const outroId = id === 42 ? 99 : 42;

    const resposta = await consultar(
      `${periodo}&usuario_id=${outroId}`,
      token(id)
    );

    assert.equal(resposta.status, 200);
    assert.equal(resposta.dados.contas[0].id, id);
  }
});

test('falha do model retorna erro 500 sem expor SQL', async () => {
  const originalConsole = console.error;
  console.error = () => {};

  try {
    Relatorio.totaisPorFonteDestino = async () => {
      throw new Error('SQL sensivel');
    };

    const resposta = await consultar(periodo, token());

    assert.deepEqual(resposta, {
      status: 500,
      dados: { erro: 'Erro interno do servidor.' },
    });
  } finally {
    console.error = originalConsole;
  }
});
test('saldo inclui somente registros do tipo conta', async () => {
  Relatorio.totaisPorFonteDestino = async () => [
    {
      id: 1,
      nome: 'Salario',
      tipo: 'renda',
      entradas: 3000,
      saidas: 0,
    },
    {
      id: 2,
      nome: 'Conta corrente',
      tipo: 'conta',
      entradas: 1000,
      saidas: 400,
    },
    {
      id: 3,
      nome: 'Cartao de credito',
      tipo: 'cartao_credito',
      entradas: 0,
      saidas: 800,
    },
  ];

  const resposta = await consultar(periodo, token());

  assert.equal(resposta.status, 200);

  assert.deepEqual(resposta.dados.contas, [
    {
      id: 2,
      nome: 'Conta corrente',
      entradas: 1000,
      saidas: 400,
      saldo: 600,
    },
  ]);

  assert.deepEqual(
    resposta.dados.entradas.map(linha => linha.id),
    [1, 2]
  );

  assert.deepEqual(
    resposta.dados.saidas.map(linha => linha.id),
    [3, 2]
  );
});