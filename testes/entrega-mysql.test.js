const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const mysql = require('mysql2/promise');

test('RF1 a RF9 pelo HTTP com schema e seed em MySQL isolado', {
  skip: process.env.TESTE_MYSQL_REAL !== '1',
}, async (t) => {
  assert.ok(process.env.DB_USER, 'Configure DB_USER da instância MySQL isolada.');
  process.env.DB_HOST ||= '127.0.0.1';
  process.env.DB_PASSWORD ??= '';
  const schema = 'teste_entrega_' + randomUUID().replaceAll('-', '');
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
    dateStrings: true,
  });
  let schemaCriado = false;
  let pool;
  let server;
  t.after(async () => {
    try {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (pool) await pool.promise().end();
      if (schemaCriado) await db.query('DROP DATABASE ??', [schema]);
    } finally {
      await db.end();
    }
  });
  await db.query('CREATE DATABASE ??', [schema]);
  schemaCriado = true;
  await db.query(readFileSync(require.resolve('../database/schema.sql'), 'utf8').replaceAll('api_financas', schema));
  await db.query(readFileSync(require.resolve('../database/seed.sql'), 'utf8'));
  const [usuariosDemo] = await db.query('SELECT senha_hash FROM usuarios ORDER BY id');
  assert.equal(usuariosDemo.length, 2);
  assert.notEqual(usuariosDemo[0].senha_hash, usuariosDemo[1].senha_hash);
  assert.ok(usuariosDemo.every(({ senha_hash }) => /^\$2b\$10\$/.test(senha_hash)));
  const [mesesPorUsuario] = await db.query(
    'SELECT COUNT(DISTINCT EXTRACT(YEAR_MONTH FROM data)) AS meses FROM lancamentos GROUP BY usuario_id',
  );
  assert.deepEqual(mesesPorUsuario.map(({ meses }) => meses), [3, 3]);
  const [[{ inconsistentes }]] = await db.query(
    `SELECT COUNT(*) AS inconsistentes FROM lancamentos l
     JOIN categorias c ON c.id = l.categoria_id
     JOIN fontes_destinos f ON f.id = l.fonte_destino_id
     WHERE c.usuario_id <> l.usuario_id OR f.usuario_id <> l.usuario_id OR c.tipo <> l.tipo
        OR (l.total_parcelas > 1 AND (f.tipo <> 'cartao_credito' OR l.grupo_parcelamento IS NULL))`,
  );
  assert.equal(inconsistentes, 0);

  process.env.DB_NAME = schema;
  process.env.JWT_SECRET = 'segredo_ficticio_apenas_entrega_teste';
  pool = require('../database/connection');
  const app = require('../server');
  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });

  async function pedir(status, metodo, rota, token, dados) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const resposta = await fetch('http://127.0.0.1:' + server.address().port + rota, {
      method: metodo, headers, body: JSON.stringify(dados),
    });
    const corpo = await resposta.text();
    assert.equal(resposta.status, status, `${metodo} ${rota}: ${corpo}`);
    if (status === 204) {
      assert.equal(corpo, '');
      return;
    }
    assert.match(resposta.headers.get('content-type'), /^application\/json\b/);
    return JSON.parse(corpo);
  }

  const senha = 'DemoFinancas123';
  const a = await pedir(200, 'POST', '/auth/login', null, { email: ' DEMO.A@EXAMPLE.TEST ', senha });
  const b = await pedir(200, 'POST', '/auth/login', null, { email: 'demo.b@example.test', senha });
  assert.notEqual(a.usuario.id, b.usuario.id);
  assert.deepEqual(await pedir(200, 'GET', '/auth/me?id=' + b.usuario.id, a.token), a.usuario);
  assert.deepEqual(Object.keys(a.usuario).sort(), ['email', 'id', 'nome']);
  await pedir(401, 'POST', '/auth/login', null, { email: a.usuario.email, senha: 'Errada123' });
  await pedir(401, 'GET', '/auth/me');
  await pedir(401, 'GET', '/lancamentos', 'invalido');

  const cadastro = { nome: 'Pessoa Demo C', email: 'demo.c@example.test', cpf: '900.000.002-56', senha };
  const c = await pedir(201, 'POST', '/auth/cadastro', null, cadastro);
  assert.deepEqual(Object.keys(c).sort(), ['email', 'id', 'nome']);
  assert.ok((await pedir(409, 'POST', '/auth/cadastro', null, {
    ...cadastro, email: ' DEMO.C@EXAMPLE.TEST ', cpf: '90000000337',
  })).campos.email);
  assert.ok((await pedir(409, 'POST', '/auth/cadastro', null, {
    ...cadastro, email: 'duplicado@example.test', cpf: '90000000256',
  })).campos.cpf);
  await pedir(400, 'POST', '/auth/cadastro', null, { ...cadastro, cpf: '00000000000' });
  const [[padroes]] = await db.execute(
    `SELECT (SELECT COUNT(*) FROM categorias WHERE usuario_id = ?) AS categorias,
            (SELECT COUNT(*) FROM fontes_destinos WHERE usuario_id = ?) AS fontes`, [c.id, c.id],
  );
  assert.deepEqual(padroes, { categorias: 9, fontes: 1 });

  const categoriasA = await pedir(200, 'GET', '/categorias?tipo=saida', a.token);
  const fontesA = await pedir(200, 'GET', '/fontes-destinos', a.token);
  const cartaoA = fontesA.find(({ tipo }) => tipo === 'cartao_credito');
  const categoria = { nome: 'Categoria temporária', tipo: 'saida', usuario_id: b.usuario.id };
  const fonte = { nome: 'Conta temporária', tipo: 'conta', usuario_id: b.usuario.id };
  for (const [rota, dados, filtro] of [
    ['/categorias', categoria, '?tipo=saida'],
    ['/fontes-destinos', fonte, '?tipo=conta'],
  ]) {
    const item = await pedir(201, 'POST', rota, a.token, dados);
    const caminho = rota + '/' + item.id;
    await pedir(409, 'POST', rota, a.token, dados);
    await pedir(400, 'POST', rota, a.token, { ...dados, tipo: 'invalido' });
    const listaB = await pedir(200, 'GET', rota + filtro + '&usuario_id=' + a.usuario.id, b.token);
    assert.ok(listaB.every(({ id }) => id !== item.id));
    await pedir(404, 'PUT', caminho, b.token, dados);
    await pedir(404, 'DELETE', caminho, b.token);
    await pedir(200, 'PUT', caminho, a.token, { ...dados, nome: dados.nome + ' atualizada' });
    await pedir(204, 'DELETE', caminho, a.token);
  }
  await pedir(400, 'POST', '/fontes-destinos', a.token, { nome: 'Cartão incompleto', tipo: 'cartao_credito' });
  await pedir(409, 'DELETE', '/categorias/' + categoriasA[0].id, a.token);
  await pedir(409, 'DELETE', '/fontes-destinos/' + cartaoA.id, a.token);

  const [[datas]] = await db.query(`SELECT UTC_DATE() AS hoje,
    DATE_SUB(UTC_DATE(), INTERVAL DAYOFMONTH(UTC_DATE()) - 1 DAY) AS inicio`);
  const periodo = new URLSearchParams({ inicio: datas.inicio, fim: datas.hoje });
  const recorte = '?' + periodo;
  const esperado = { entradas: 3200, saidas: 350, saldo: 2850 };
  const lista = await pedir(200, 'GET', '/lancamentos' + recorte, a.token);
  assert.deepEqual(lista.resumo, esperado);
  const alheio = '/lancamentos/' + lista.itens[0].id;
  const compra = {
    tipo: 'saida', descricao: 'Compra temporária', valor: 100, data: datas.hoje,
    categoriaId: categoriasA[0].id, fonteDestinoId: cartaoA.id,
  };
  await pedir(404, 'GET', alheio, b.token);
  await pedir(404, 'PUT', alheio, b.token, compra);
  await pedir(404, 'DELETE', alheio, b.token);
  await pedir(404, 'POST', '/lancamentos', b.token, compra);
  await pedir(400, 'POST', '/lancamentos', a.token, { ...compra, tipo: 'entrada' });
  const simples = await pedir(201, 'POST', '/lancamentos', a.token, compra);
  await pedir(200, 'GET', '/lancamentos/' + simples.id, a.token);
  await pedir(200, 'PUT', '/lancamentos/' + simples.id, a.token, { ...compra, valor: 101 });
  await pedir(204, 'DELETE', '/lancamentos/' + simples.id, a.token);

  const parcelas = await pedir(201, 'POST', '/lancamentos', a.token, { ...compra, parcelas: 3 });
  assert.deepEqual(parcelas.map(({ valor }) => valor), [33.34, 33.33, 33.33]);
  await pedir(204, 'DELETE', '/lancamentos/' + parcelas[1].id, a.token);
  await pedir(204, 'DELETE', '/lancamentos/' + parcelas[0].id + '?todasParcelas=true', a.token);
  await pedir(404, 'GET', '/lancamentos/' + parcelas[2].id, a.token);
  const lote = await pedir(201, 'POST', '/lancamentos', a.token, { ...compra, valor: 23, parcelas: 23 });
  const filtros = recorte + '&tipo=saida&categoriaId=' + compra.categoriaId + '&fonteDestinoId=' + cartaoA.id;
  const pagina1 = await pedir(200, 'GET', '/lancamentos' + filtros, a.token);
  const pagina2 = await pedir(200, 'GET', '/lancamentos' + filtros + '&pagina=2', a.token);
  assert.deepEqual([pagina1.itens.length, pagina2.itens.length, pagina2.totalPaginas], [20, 6, 2]);
  assert.deepEqual(pagina1.resumo, { entradas: 0, saidas: 123, saldo: -123 });
  assert.deepEqual(pagina2.resumo, pagina1.resumo);
  await pedir(204, 'DELETE', '/lancamentos/' + lote[0].id + '?todasParcelas=true', a.token);

  for (const [token, letra, entrada, saida, saldoConta, valores] of [
    [a.token, 'A', 3200, 350, 2950, [33.34, 33.33, 33.33]],
    [b.token, 'B', 1600, 45, 1600, [45, 0, 0]],
  ]) {
    const categorias = await pedir(200, 'GET', '/relatorios/categorias' + recorte, token);
    assert.equal(categorias.entradas.total, entrada);
    assert.equal(categorias.saidas.total, saida);
    assert.equal(categorias.saidas.categorias[0].nome, 'Compras Demo ' + letra);
    const fontes = await pedir(200, 'GET', '/relatorios/fontes-destinos' + recorte, token);
    assert.deepEqual(fontes.contas.map(({ nome, saldo }) => [nome, saldo]), [['Conta Demo ' + letra, saldoConta]]);
    const { cartoes } = await pedir(200, 'GET', '/relatorios/faturas?meses=3', token);
    assert.deepEqual(cartoes.map(({ nome }) => nome), ['Cartão Demo ' + letra]);
    assert.deepEqual(cartoes[0].faturas.map(({ total }) => total), valores);
    assert.equal(cartoes[0].limiteUtilizado, letra === 'A' ? 100 : 45);
  }
  await pedir(400, 'GET', '/relatorios/categorias?inicio=2026-02-30', a.token);
  await pedir(400, 'GET', '/relatorios/fontes-destinos', a.token);
  await pedir(400, 'GET', '/relatorios/faturas?meses=13', a.token);
});
