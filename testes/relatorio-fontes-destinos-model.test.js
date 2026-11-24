const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../database/connection');
const Relatorio = require('../models/Relatorio');

const promiseOriginal = pool.promise;

afterEach(() => {
  pool.promise = promiseOriginal;
});

test('agrega entradas e saidas por fonte e destino', async () => {
  const chamadas = [];

  pool.promise = () => ({
    execute: async (sql, params) => {
      chamadas.push({ sql, params });

      return [[
        {
          id: 1,
          nome: 'Conta corrente',
          tipo: 'conta',
          entradas: '1500.00',
          saidas: '500.50',
        },
        {
          id: 2,
          nome: 'Carteira',
          tipo: 'conta',
          entradas: '0.00',
          saidas: '0.00',
        },
      ]];
    },
  });

  const linhas = await Relatorio.totaisPorFonteDestino(
    42, '2026-10-01', '2026-10-31'
  );

  assert.equal(chamadas.length, 1);

  const { sql, params } = chamadas[0];

  assert.match(sql, /SUM\s*\(/i);
  assert.match(sql, /GROUP\s+BY\s+fd\.id/i);
  assert.match(sql, /LEFT\s+JOIN/i);
  assert.match(sql, /fd\.usuario_id\s*=\s*\?/i);
  assert.match(sql, /l\.usuario_id\s*=\s*fd\.usuario_id/i);
  assert.match(sql, /l\.data\s+BETWEEN\s+\?\s+AND\s+\?/i);

  assert.deepEqual(params, [
    '2026-10-01', '2026-10-31', 42,
  ]);

  assert.deepEqual(linhas, [
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
      entradas: 0,
      saidas: 0,
    },
  ]);
});

test('retorna lista vazia quando nao existem fontes ou destinos', async () => {
  pool.promise = () => ({
    execute: async () => [[]],
  });

  const linhas = await Relatorio.totaisPorFonteDestino(
    99, '2026-10-01', '2026-10-31'
  );

  assert.deepEqual(linhas, []);
});

test('repassa falhas do banco de dados', async () => {
  pool.promise = () => ({
    execute: async () => {
      throw new Error('Falha no banco');
    },
  });

  await assert.rejects(
    Relatorio.totaisPorFonteDestino(
      42, '2026-10-01', '2026-10-31'
    ),
    /Falha no banco/
  );
});