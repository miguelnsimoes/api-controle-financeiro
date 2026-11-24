const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'segredo_ficticio_para_testes_de_lancamentos';
const app = require('../server');
const pool = require('../database/connection');
const { dividirEmParcelas, validarLancamento } = require('../utils/validarLancamento');

test('parcelamento preserva centavos e rejeita parcelas sem valor', () => {
  assert.deepEqual(dividirEmParcelas(100, 3), [33.34, 33.33, 33.33]);
  assert.deepEqual(dividirEmParcelas(0.48, 48), Array(48).fill(0.01));
  const dados = {
    tipo: 'saida', descricao: 'Compra', valor: 0.02,
    data: '2026-11-24', categoriaId: 2, fonteDestinoId: 3,
  };
  for (const parcelas of [0, 49, 1.5, '3', null, 3]) {
    assert.ok(validarLancamento({ ...dados, parcelas }, true).campos.parcelas);
  }
  assert.equal(validarLancamento({ ...dados, parcelas: 2 }, true).dados.parcelas, 2);
});

test('CRUD de lançamentos pelo HTTP com JWT e conexão MySQL simulada', async (t) => {
  const dados = {
    tipo: 'saida', descricao: 'Mercado', valor: 25.75,
    data: '2028-02-29', categoriaId: 2, fonteDestinoId: 3,
  };
  let linha;
  let falharInsert = false;
  let totalConsultas = 0;
  const eventos = [];
  const conexao = {
    beginTransaction: async () => eventos.push('begin'),
    commit: async () => eventos.push('commit'),
    rollback: async () => eventos.push('rollback'),
    release: () => eventos.push('release'),
    async execute(sql, parametros) {
      totalConsultas += 1;
      if (sql.includes('FROM categorias WHERE')) {
        assert.match(sql, /id = \? AND usuario_id = \? FOR SHARE/);
        return [parametros.join() === '2,42' ? [{ tipo: 'saida' }] : []];
      }
      if (sql.includes('FROM fontes_destinos WHERE')) {
        assert.match(sql, /id = \? AND usuario_id = \? FOR SHARE/);
        return [parametros.join() === '3,42' ? [{ id: 3 }] : []];
      }
      if (sql.startsWith('INSERT')) {
        if (falharInsert) throw new Error('falha simulada');
        assert.deepEqual(parametros, ['saida', 'Mercado', 25.75, '2028-02-29', 2, 3, 42]);
        linha = {
          id: 1, tipo: 'saida', descricao: 'Mercado', valor: '25.75', data: dados.data,
          categoria_id: 2, categoria_nome: 'Alimentação',
          fonte_destino_id: 3, fonte_destino_nome: 'Conta',
          parcela_atual: 1, total_parcelas: 1,
        };
        return [{ insertId: 1 }];
      }
      if (sql.startsWith('UPDATE')) {
        assert.match(sql, /WHERE id = \? AND usuario_id = \?/);
        assert.deepEqual(parametros, ['saida', 'Feira', 25.75, dados.data, 2, 3, 1, 42]);
        linha.descricao = parametros[1];
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('DELETE')) {
        assert.match(sql, /WHERE id = \? AND usuario_id = \?/);
        if (!linha || parametros.join() !== '1,42') return [{ affectedRows: 0 }];
        linha = undefined;
        return [{ affectedRows: 1 }];
      }
      assert.match(sql, /usuario_id = \?/);
      const dono = parametros.length === 1 ? parametros[0] === 42 : parametros.join() === '1,42';
      return [linha && dono ? [linha] : []];
    },
  };
  t.mock.method(pool, 'promise', () => ({
    execute: conexao.execute,
    getConnection: async () => conexao,
  }));

  const server = await new Promise((resolve) => {
    const http = app.listen(0, '127.0.0.1', () => resolve(http));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  async function requisicao(method, caminho = '', id = 42, corpo) {
    const headers = { 'Content-Type': 'application/json' };
    if (id) headers.Authorization = 'Bearer ' + jwt.sign({ id }, process.env.JWT_SECRET);
    const resposta = await fetch(`http://127.0.0.1:${server.address().port}/lancamentos${caminho}`, {
      method, headers, body: JSON.stringify(corpo),
    });
    const texto = await resposta.text();
    return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
  }

  for (const [metodo, caminho] of [['GET', ''], ['GET', '/1'], ['POST', ''], ['PUT', '/1'], ['DELETE', '/1']]) {
    assert.equal((await requisicao(metodo, caminho, null)).status, 401);
  }
  assert.equal((await requisicao('GET', '/1e0')).status, 400);
  for (const metodo of ['GET', 'PUT', 'DELETE']) {
    assert.deepEqual(await requisicao(metodo, '/%E0%A4%A', 42, metodo === 'PUT' ? dados : undefined), {
      status: 400,
      corpo: { erro: 'Dados inválidos.', campos: { id: 'Informe um identificador válido.' } },
    });
  }
  assert.deepEqual((await requisicao('POST', '', 42, {
    tipo: 'renda', descricao: ' ', valor: '25.75', data: '2026-02-29', categoriaId: 0,
  })).status, 400);
  assert.deepEqual(eventos, []);
  assert.equal(totalConsultas, 0);

  assert.equal((await requisicao('POST', '', 42, { ...dados, tipo: 'entrada' })).status, 400);
  assert.equal((await requisicao('POST', '', 42, { ...dados, categoriaId: 99 })).status, 404);
  assert.equal((await requisicao('POST', '', 42, { ...dados, fonteDestinoId: 99 })).status, 404);
  assert.deepEqual(eventos.splice(0), Array.from({ length: 3 }, () => ['begin', 'rollback', 'release']).flat());

  falharInsert = true;
  assert.deepEqual(await requisicao('POST', '', 42, dados), {
    status: 500, corpo: { erro: 'Erro interno do servidor.' },
  });
  assert.deepEqual(eventos.splice(0), ['begin', 'rollback', 'release']);
  falharInsert = false;

  const criado = await requisicao('POST', '', 42, { ...dados, descricao: ' Mercado ', usuarioId: 99 });
  assert.equal(criado.status, 201);
  assert.deepEqual(criado.corpo, {
    id: 1, tipo: 'saida', descricao: 'Mercado', valor: 25.75, data: dados.data,
    categoria: { id: 2, nome: 'Alimentação' }, fonteDestino: { id: 3, nome: 'Conta' }, parcela: '1/1',
  });
  assert.deepEqual(eventos.splice(0), ['begin', 'commit', 'release']);
  assert.deepEqual(await requisicao('GET', '?usuarioId=99'), { status: 200, corpo: [criado.corpo] });
  assert.deepEqual(await requisicao('GET', '/1'), { status: 200, corpo: criado.corpo });
  assert.deepEqual(await requisicao('GET', '?usuarioId=42', 99), { status: 200, corpo: [] });
  assert.equal((await requisicao('GET', '/1', 99)).status, 404);
  assert.equal((await requisicao('PUT', '/1', 99, dados)).status, 404);
  assert.equal((await requisicao('DELETE', '/1', 99)).status, 404);

  const editado = await requisicao('PUT', '/1', 42, { ...dados, descricao: 'Feira' });
  assert.deepEqual(editado, { status: 200, corpo: { ...criado.corpo, descricao: 'Feira' } });
  assert.deepEqual(await requisicao('DELETE', '/1'), { status: 204, corpo: null });
  assert.equal((await requisicao('GET', '/1')).status, 404);
  assert.equal((await requisicao('DELETE', '/1')).status, 404);
});
