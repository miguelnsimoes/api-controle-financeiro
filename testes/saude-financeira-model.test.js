
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  analisarSaudeFinanceira,
  inicioHistorico,
} = require('../utils/saude-financeira');

const agora = new Date('2026-11-15T00:00:00Z');

function lancamento(data, tipo, valor, extras = {}) {
  return {
    data,
    tipo,
    valor,
    tipo_fonte: 'conta',
    parcela_atual: 1,
    total_parcelas: 1,
    ...extras,
  };
}

test('calcula corretamente a taxa de poupanca', () => {
  const linhas = [
    lancamento('2026-11-01', 'entrada', 5000),
    lancamento('2026-11-05', 'saida', 3500),
  ];

  const resultado = analisarSaudeFinanceira(linhas, agora);

  assert.equal(resultado.indicadores.taxaPoupanca, 0.3);
});

test('retorna taxa negativa quando despesas superam renda', () => {
  const linhas = [
    lancamento('2026-11-01', 'entrada', 1000),
    lancamento('2026-11-05', 'saida', 1500),
  ];

  const resultado = analisarSaudeFinanceira(linhas, agora);

  assert.equal(resultado.indicadores.taxaPoupanca, -0.5);
  assert.ok(resultado.dicas.some(
    dica => dica.includes('superam')
  ));
});

test('trata ausencia de renda sem divisao por zero', () => {
  const resultado = analisarSaudeFinanceira([], agora);

  assert.equal(resultado.indicadores.taxaPoupanca, null);
  assert.equal(resultado.indicadores.comprometimentoCartoes, null);
  assert.equal(resultado.indicadores.totalParcelasFuturas, 0);
  assert.equal(resultado.projecao.length, 6);
  assert.ok(resultado.dicas.length > 0);
});

test('calcula parcelas futuras pelo vencimento da fatura', () => {
  const cartao = {
    tipo_fonte: 'cartao_credito',
    dia_fechamento: 10,
    dia_vencimento: 20,
    total_parcelas: 3,
  };

  const linhas = [
    lancamento('2026-11-12', 'saida', 100, {
      ...cartao,
      parcela_atual: 1,
    }),
    lancamento('2026-11-12', 'saida', 100, {
      ...cartao,
      parcela_atual: 2,
    }),
    lancamento('2026-11-12', 'saida', 100, {
      ...cartao,
      parcela_atual: 3,
    }),
  ];

  const resultado = analisarSaudeFinanceira(linhas, agora);

  assert.equal(resultado.indicadores.totalParcelasFuturas, 300);

  assert.deepEqual(resultado.indicadores.parcelasPorMes, [
    { mes: '2026-12', total: 100 },
    { mes: '2027-01', total: 100 },
    { mes: '2027-02', total: 100 },
  ]);
});

test('calcula comprometimento da renda com cartoes', () => {
  const linhas = [
    lancamento('2026-08-01', 'entrada', 3000),
    lancamento('2026-09-01', 'entrada', 3000),
    lancamento('2026-10-01', 'entrada', 3000),
    lancamento('2026-11-12', 'saida', 1500, {
      tipo_fonte: 'cartao_credito',
      dia_fechamento: 10,
      dia_vencimento: 20,
    }),
  ];

  const resultado = analisarSaudeFinanceira(linhas, agora);

  assert.equal(
    resultado.indicadores.comprometimentoCartoes,
    0.5
  );
});

test('projeta saldo usando os tres meses completos anteriores', () => {
  const linhas = [];

  for (const mes of ['08', '09', '10']) {
    linhas.push(
      lancamento(`2026-${mes}-01`, 'entrada', 3000),
      lancamento(`2026-${mes}-05`, 'saida', 2000)
    );
  }

  const resultado = analisarSaudeFinanceira(linhas, agora);

  assert.equal(resultado.projecao.length, 6);

  assert.deepEqual(resultado.projecao[0], {
    mes: '2026-12',
    entradas: 3000,
    saidas: 2000,
    parcelas: 0,
    saldoPrevisto: 1000,
  });

  assert.equal(resultado.projecao[5].mes, '2027-05');
});

test('nao contabiliza parcelas duas vezes na projecao', () => {
  const linhas = [];

  for (const mes of ['08', '09', '10']) {
    linhas.push(
      lancamento(`2026-${mes}-01`, 'entrada', 3000),
      lancamento(`2026-${mes}-05`, 'saida', 2000)
    );
  }

  for (let parcela = 1; parcela <= 6; parcela++) {
    linhas.push(
      lancamento('2026-08-05', 'saida', 300, {
        tipo_fonte: 'cartao_credito',
        dia_fechamento: 10,
        dia_vencimento: 20,
        parcela_atual: parcela,
        total_parcelas: 6,
      })
    );
  }

  const resultado = analisarSaudeFinanceira(linhas, agora);

  assert.equal(resultado.projecao[0].parcelas, 300);
  assert.equal(resultado.projecao[0].saidas, 2300);
  assert.equal(resultado.projecao[0].saldoPrevisto, 700);
});

test('gera alerta quando saldo projetado e negativo', () => {
  const linhas = [];

  for (const mes of ['08', '09', '10']) {
    linhas.push(
      lancamento(`2026-${mes}-01`, 'entrada', 1000),
      lancamento(`2026-${mes}-05`, 'saida', 2000)
    );
  }

  const resultado = analisarSaudeFinanceira(linhas, agora);

  assert.equal(resultado.projecao[0].saldoPrevisto, -1000);

  assert.ok(resultado.dicas.some(
    dica => dica.includes('saldo previsto')
  ));
});

test('inclui aviso educativo obrigatorio', () => {
  const resultado = analisarSaudeFinanceira([], agora);

  assert.equal(
    resultado.aviso,
    'Informações educativas; não constituem recomendação financeira profissional.'
  );
});

test('define historico suficiente para compras parceladas antigas', () => {
  assert.equal(inicioHistorico(agora), '2022-07-01');
});

const pool = require('../database/connection');
const SaudeFinanceira = require('../models/SaudeFinanceira');

test('consulta SQL restringe lancamentos ao usuario autenticado', async (t) => {
  const chamadas = [];

  t.mock.method(pool, 'promise', () => ({
    execute: async (sql, parametros) => {
      chamadas.push({ sql, parametros });

      return [[{
        id: 1,
        tipo: 'entrada',
        valor: '1500.50',
        data: '2026-11-01',
      }]];
    },
  }));

  const resultado = await SaudeFinanceira.buscarLancamentos(
    42,
    '2022-07-01'
  );

  assert.equal(chamadas.length, 1);

  assert.match(
    chamadas[0].sql,
    /WHERE\s+l\.usuario_id\s*=\s*\?/i
  );

  assert.match(
    chamadas[0].sql,
    /fd\.usuario_id\s*=\s*l\.usuario_id/i
  );

  assert.deepEqual(
    chamadas[0].parametros,
    [42, '2022-07-01']
  );

  assert.equal(resultado[0].valor, 1500.5);
  assert.equal(typeof resultado[0].valor, 'number');
});

test('model retorna lista vazia sem lancamentos', async (t) => {
  t.mock.method(pool, 'promise', () => ({
    execute: async () => [[]],
  }));

  const resultado = await SaudeFinanceira.buscarLancamentos(
    42,
    '2022-07-01'
  );

  assert.deepEqual(resultado, []);
});

test('model propaga falhas do banco de dados', async (t) => {
  t.mock.method(pool, 'promise', () => ({
    execute: async () => {
      throw new Error('Falha no banco');
    },
  }));

  await assert.rejects(
    SaudeFinanceira.buscarLancamentos(42, '2022-07-01'),
    /Falha no banco/
  );
});
