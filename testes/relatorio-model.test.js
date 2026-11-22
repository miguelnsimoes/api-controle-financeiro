const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../database/connection');
const Relatorio = require('../models/Relatorio');

const promiseOriginal = pool.promise;
afterEach(() => { pool.promise = promiseOriginal; });

test('agrega no MySQL com SUM, GROUP BY e filtra pelo usuário autenticado', async () => {
  const chamadas = [];
  pool.promise = () => ({
    execute: async (sql, params) => {
      chamadas.push({ sql, params });
      return [[
        { id: 3, nome: 'Moradia', tipo: 'saida', total: '980.50' },
        { id: 1, nome: 'Salário', tipo: 'entrada', total: '5200.00' },
      ]];
    },
  });
  const linhas = await Relatorio.totaisPorCategoria(42, '2026-10-01', '2026-10-31');
  assert.equal(chamadas.length, 1);
  assert.match(chamadas[0].sql, /SUM\s*\(\s*l\.valor\s*\)/i);
  assert.match(chamadas[0].sql, /GROUP\s+BY\s+c\.id/i);
  assert.match(chamadas[0].sql, /l\.usuario_id\s*=\s*\?/i);
  assert.match(chamadas[0].sql, /c\.usuario_id\s*=\s*l\.usuario_id/i);
  assert.deepEqual(chamadas[0].params, [42, '2026-10-01', '2026-10-31']);
  assert.deepEqual(linhas, [
    { id: 3, nome: 'Moradia', tipo: 'saida', total: 980.5 },
    { id: 1, nome: 'Salário', tipo: 'entrada', total: 5200 },
  ]);
  assert.equal(typeof linhas[0].total, 'number');
});
