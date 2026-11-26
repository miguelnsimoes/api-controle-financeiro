const assert = require('node:assert/strict');
const fs = require('node:fs');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

// Execute com TESTE_MYSQL_REAL=1 e DB_HOST, DB_USER e DB_PASSWORD de uma instância de testes.
test('lançamentos por HTTP com MySQL real', { skip: process.env.TESTE_MYSQL_REAL !== '1' }, async (t) => {
  assert.ok(process.env.DB_USER, 'Configure DB_USER da instância MySQL isolada.');
  process.env.DB_HOST ||= '127.0.0.1';
  process.env.DB_PASSWORD ??= '';
  const schema = 'teste_parcelamento_' + randomUUID().replaceAll('-', '');
  process.env.DB_NAME = schema;
  process.env.JWT_SECRET = 'segredo_ficticio_para_teste_mysql';
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
  const app = require('../server');
  const pool = require('../database/connection');
  let server;
  let schemaCriado = false;
  try {
   const [[{version}]] = await db.query('SELECT VERSION() AS version');
   await db.query('CREATE DATABASE ??', [schema]);
   schemaCriado = true;
   await db.query(fs.readFileSync(require.resolve('../database/schema.sql'), 'utf8').replaceAll('api_financas', schema));
   await db.query("INSERT INTO usuarios(nome,email,cpf,senha_hash) VALUES ('A','a@example.com','11111111111','ficticio'),('B','b@example.com','22222222222','ficticio')");
   await db.query("INSERT INTO categorias(usuario_id,nome,tipo) VALUES (1,'Compras','saida'),(2,'Compras','saida')");
   await db.query("INSERT INTO fontes_destinos(usuario_id,nome,tipo,dia_fechamento,dia_vencimento,limite) VALUES (1,'Cartao','cartao_credito',15,20,1000),(2,'Cartao','cartao_credito',15,20,1000),(1,'Conta','conta',NULL,NULL,NULL)");
   server = await new Promise(resolve => { const listener = app.listen(0,'127.0.0.1',()=>resolve(listener)); });
   async function req(method, path, status, body, owner=1) {
     const headers = {'Content-Type':'application/json'};
     if (owner) headers.Authorization = 'Bearer '+jwt.sign({id:owner},process.env.JWT_SECRET);
     const response = await fetch('http://127.0.0.1:'+server.address().port+'/lancamentos'+path,{method,headers,body:JSON.stringify(body)});
     const result = await response.text();
    if (Array.isArray(status)) {
      assert.ok(status.includes(response.status), result);
      return response.status;
    }
    assert.equal(response.status, status, result);
     return result && JSON.parse(result);
   }
   const data = {tipo:'saida',descricao:'Compra',valor:100,data:'2028-02-29',categoriaId:1,fonteDestinoId:1};
   await req('GET','',401,undefined,0);
   const simples = await req('POST','',201,data);
   assert.equal(simples.parcela,'1/1');
   assert.equal((await req('GET','/'+simples.id,200)).valor,100);
   assert.equal((await req('PUT','/'+simples.id,200,{...data,descricao:'Editado'})).descricao,'Editado');
   await req('GET','/'+simples.id,404,undefined,2);
   await req('PUT','/'+simples.id,404,data,2);
   await req('DELETE','/'+simples.id,404,undefined,2);
   const periodoCompra = '?inicio=2028-02-29&fim=2028-02-29';
   assert.deepEqual((await req('GET',periodoCompra,200,undefined,2)).itens,[]);
   await req('DELETE','/'+simples.id+'?todasParcelas=true',204);
   for (const parcelas of [0,49,1.5,'3',null]) await req('POST','',400,{...data,parcelas});
   await req('POST','',400,{...data,valor:0.02,parcelas:3});
   await req('POST','',400,{...data,fonteDestinoId:3,parcelas:3});
   await req('POST','',404,{...data,fonteDestinoId:2,parcelas:3});
   await req('POST','',404,{...data,categoriaId:2,parcelas:3});
   const parcelas = await req('POST','',201,{...data,parcelas:3});
   assert.deepEqual(parcelas.map(p=>p.valor),[33.34,33.33,33.33]);
   assert.deepEqual(parcelas.map(p=>p.parcela),['1/3','2/3','3/3']);
   assert.equal(parcelas.reduce((total,p)=>total+Math.round(p.valor*100),0),10000);
   const [rows] = await db.query('SELECT id, DATE_FORMAT(data,"%Y-%m-%d") AS data, grupo_parcelamento FROM lancamentos ORDER BY id');
   assert.equal(rows.length,3);
   assert.match(rows[0].grupo_parcelamento,/^[a-f0-9-]{36}$/);
   assert.ok(rows.every(row=>row.grupo_parcelamento===rows[0].grupo_parcelamento && row.data===data.data));
   await req('POST','',400,{...data,data:'2027-02-29',parcelas:3});
   const primeira = '/'+parcelas[0].id;
   await req('PUT',primeira,400,{...data,valor:33.34,data:'2028-03-01'});
   await req('PUT',primeira,400,{...data,valor:34});
   await req('PUT',primeira,400,{...data,valor:33.34,fonteDestinoId:3});
  await req('PUT',primeira,404,{...data,valor:33.34,fonteDestinoId:2});
   const editada = await req('PUT',primeira,200,{...data,valor:33.34,descricao:'Descrição atualizada'});
   assert.equal(editada.parcela,'1/3');
   assert.equal(editada.data,data.data);
   const outro = await req('POST','',201,{...data,categoriaId:2,fonteDestinoId:2,parcelas:1},2);
   await db.execute('UPDATE lancamentos SET grupo_parcelamento = ? WHERE id = ?',[rows[0].grupo_parcelamento,outro[0].id]);
   await req('DELETE','/'+parcelas[0].id+'?todasParcelas=true',404,undefined,2);
   await req('DELETE','/'+parcelas[0].id+'?todasParcelas=x',400);
   await req('DELETE','/'+parcelas[0].id+'?todasParcelas=false',204);
   assert.equal((await req('GET',periodoCompra,200)).itens.length,2);
   await req('DELETE','/'+parcelas[1].id+'?todasParcelas=true',204);
   assert.deepEqual((await req('GET',periodoCompra,200)).itens,[]);
   assert.equal((await req('GET',periodoCompra,200,undefined,2)).itens.length,1);
   await req('DELETE','/'+outro[0].id+'?todasParcelas=true',204,undefined,2);
   const max = await req('POST','',201,{...data,valor:0.48,parcelas:48});
   assert.equal(max.length,48);
   assert.ok(max.every(p=>p.valor===0.01));
   await req('DELETE','/'+max[0].id+'?todasParcelas=true',204);
   const concorrentes = await Promise.all([3, 4].map(q => req('POST','',201,{...data,parcelas:q})));
   const [grupos] = await db.query('SELECT COUNT(DISTINCT grupo_parcelamento) AS total FROM lancamentos');
   assert.equal(grupos[0].total,2);
   await req('DELETE','/'+concorrentes[0][0].id+'?todasParcelas=true',204);
   assert.equal((await req('GET',periodoCompra,200)).itens.length,4);
   await req('DELETE','/'+concorrentes[1][0].id+'?todasParcelas=true',204);
  const corrida = await req('POST', '', 201, {...data, parcelas: 3});
  const statusExclusoes = await Promise.all([
    req('DELETE', '/' + corrida[0].id + '?todasParcelas=true', [204, 404]),
    req('DELETE', '/' + corrida[1].id + '?todasParcelas=true', [204, 404]),
  ]);
  assert.deepEqual(statusExclusoes.sort(), [204, 404]);
  assert.deepEqual((await req('GET', periodoCompra, 200)).itens, []);
   await db.query("CREATE TRIGGER falhar_segunda_parcela BEFORE INSERT ON lancamentos FOR EACH ROW BEGIN IF NEW.parcela_atual = 2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falha de teste'; END IF; END");
   assert.deepEqual(await req('POST','',500,{...data,parcelas:3}),{erro:'Erro interno do servidor.'});
   const [[{total}]] = await db.query('SELECT COUNT(*) AS total FROM lancamentos');
   assert.equal(total,0);
   await db.query('DROP TRIGGER falhar_segunda_parcela');
   await t.test('combina filtros, pagina e calcula os totais exatos de todos os resultados', async () => {
     const agora = new Date();
     const ano = agora.getUTCFullYear();
     const mes = agora.getUTCMonth();
     const inicio = agora.toISOString().slice(0, 7) + '-01';
     const fim = new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10);
     const anterior = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
     await db.query("INSERT INTO categorias(usuario_id,nome,tipo) VALUES (1,'Receita','entrada'),(1,'Outra despesa','saida')");
     const compra = { ...data, data: inicio, valor: 2.3, parcelas: 23 };
     const parcelasDoMes = await req('POST', '', 201, compra);
     await req('POST', '', 201, { ...data, data: fim, tipo: 'entrada', categoriaId: 3, fonteDestinoId: 3, valor: 0.3 });
     await req('POST', '', 201, { ...data, data: inicio, fonteDestinoId: 3, valor: 0.2 });
     await req('POST', '', 201, { ...data, data: inicio, categoriaId: 4, valor: 0.1 });
     await req('POST', '', 201, { ...data, data: anterior, valor: 100 });
     await req('POST', '', 201, { ...data, data: inicio, categoriaId: 2, fonteDestinoId: 2, valor: 200 }, 2);

     const padrao = await req('GET', '?usuarioId=2', 200);
     assert.deepEqual(padrao.periodo, { inicio, fim });
     assert.deepEqual(padrao.resumo, { entradas: 0.3, saidas: 2.6, saldo: -2.3 });
     assert.equal(padrao.itens.length, 20);
     const filtros = '?inicio=' + inicio + '&fim=' + fim + '&tipo=saida&categoriaId=1&fonteDestinoId=1';
     const primeira = await req('GET', filtros, 200);
     const segunda = await req('GET', filtros + '&pagina=2', 200);
     const fora = await req('GET', filtros + '&pagina=3', 200);
     assert.equal(primeira.pagina, 1);
     assert.equal(segunda.pagina, 2);
     assert.equal(fora.pagina, 3);
     assert.deepEqual([primeira.totalPaginas, segunda.totalPaginas, fora.totalPaginas], [2, 2, 2]);
     assert.deepEqual([primeira.itens.length, segunda.itens.length, fora.itens.length], [20, 3, 0]);
     assert.deepEqual(primeira.resumo, { entradas: 0, saidas: 2.3, saldo: -2.3 });
     assert.deepEqual(segunda.resumo, primeira.resumo);
     assert.deepEqual(fora.resumo, primeira.resumo);
     const ultimaPaginaValida = await req('GET', filtros + '&pagina=' + Number.MAX_SAFE_INTEGER, 200);
     assert.equal(ultimaPaginaValida.pagina, Number.MAX_SAFE_INTEGER);
     assert.equal(ultimaPaginaValida.totalPaginas, 2);
     assert.deepEqual(ultimaPaginaValida.itens, []);
     assert.deepEqual(ultimaPaginaValida.resumo, primeira.resumo);
     assert.deepEqual([...primeira.itens, ...segunda.itens].map(item => item.id), parcelasDoMes.map(item => item.id).reverse());
     assert.equal(segunda.itens[2].parcela, '1/23');

     assert.deepEqual((await req('GET', '?fim=' + anterior, 200)).periodo, { inicio: null, fim: anterior });
     assert.equal((await req('GET', '?fim=' + anterior, 200)).resumo.saidas, 100);
     assert.deepEqual((await req('GET', '?inicio=' + inicio, 200)).periodo, { inicio, fim: null });
     assert.equal((await req('GET', '?tipo=entrada', 200)).resumo.entradas, 0.3);
     assert.equal((await req('GET', '?categoriaId=4', 200)).resumo.saidas, 0.1);
     assert.equal((await req('GET', '?fonteDestinoId=3', 200)).resumo.saldo, 0.1);
     const vazio = await req('GET', '?tipo=entrada&categoriaId=4', 200);
     assert.deepEqual(vazio.resumo, { entradas: 0, saidas: 0, saldo: 0 });
     assert.equal(vazio.totalPaginas, 0);
     assert.deepEqual(vazio.itens, []);
     assert.equal((await req('GET', '', 200, undefined, 2)).resumo.saidas, 200);
     const dataValoresAltos = new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 10);
     await req('POST', '', 201, { ...data, data: dataValoresAltos, valor: 9999999999.98 });
     await req('POST', '', 201, {
       ...data, data: dataValoresAltos, tipo: 'entrada', categoriaId: 3, valor: 9999999999.99,
     });
     const valoresAltos = await req('GET', '?inicio=' + dataValoresAltos + '&fim=' + dataValoresAltos, 200);
     assert.deepEqual(valoresAltos.resumo, { entradas: 9999999999.99, saidas: 9999999999.98, saldo: 0.01 });
     await req('GET', '?categoriaId=2', 404);
     await req('GET', '?fonteDestinoId=2', 404);
     await req('GET', '?categoriaId=999', 404);
     for (const query of [
       '?pagina=0', '?pagina=1&pagina=2', '?pagina=1.5', '?pagina=9007199254740992',
       '?tipo=entrada%27%20OR%201%3D1', '?categoriaId=1%20OR%201%3D1',
       '?fonteDestinoId=-1', '?inicio=2027-02-29', '?fim=',
       '?inicio=2028-03-01&fim=2028-02-29',
     ]) {
       const erro = await req('GET', query, 400);
       assert.equal(erro.erro, 'Dados inválidos.');
       assert.equal(Object.keys(erro.campos).length, 1);
     }
   });
   await t.test('prevê faturas e inclui parcelas fora da janela no cálculo do limite', async () => {
     const [novosCartoes] = await db.query(
       `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite)
        VALUES (1, 'Sem uso', 'cartao_credito', 31, 5, 1000),
               (1, 'Uso parcial', 'cartao_credito', 31, 5, 1000),
               (1, 'Uso total', 'cartao_credito', 31, 5, 1000),
               (1, 'Excedido', 'cartao_credito', 31, 5, 1000)`,
     );
     const primeiroId = novosCartoes.insertId;
     const hoje = new Date().toISOString().slice(0, 10);
     const criarCompra = (fonteDestinoId, valor, parcelas) => req('POST', '', 201, {
       ...data, data: hoje, fonteDestinoId, valor, parcelas,
     });
     await criarCompra(primeiroId + 1, 0.1);
     await criarCompra(primeiroId + 1, 0.2);
     await criarCompra(primeiroId + 2, 1000);
     const parcelas = await criarCompra(primeiroId + 3, 1200, 4);
     await req('POST', '', 201, {
       ...data, tipo: 'entrada', categoriaId: 3, data: hoje, fonteDestinoId: primeiroId, valor: 25,
     });
     await db.execute(
       `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
        VALUES (2, 'saida', 'Vínculo inconsistente de teste', 42, ?, 2, ?)`,
       [hoje, primeiroId],
     );

     async function prever(query = '', dono = 1) {
       const headers = {};
       if (dono) headers.Authorization = 'Bearer ' + jwt.sign({ id: dono }, process.env.JWT_SECRET);
       const resposta = await fetch('http://127.0.0.1:' + server.address().port + '/relatorios/faturas' + query, { headers });
       return { status: resposta.status, corpo: await resposta.json() };
     }

     assert.equal((await prever('', 0)).status, 401);
     for (const query of ['?meses=0', '?meses=13', '?meses=1.5', '?meses=1&meses=2', '?meses=']) {
       const invalido = await prever(query);
       assert.equal(invalido.status, 400);
       assert.ok(invalido.corpo.campos.meses);
     }
     const resposta = await prever('?meses=1');
     assert.equal(resposta.status, 200);
     const cartoes = resposta.corpo.cartoes.filter(({ id }) => id >= primeiroId);
     assert.equal(cartoes.length, 4);
     assert.deepEqual(cartoes.map(({ limiteTotal, limiteUtilizado, limiteDisponivel }) =>
       [limiteTotal, limiteUtilizado, limiteDisponivel]), [
       [1000, 0, 1000], [1000, 0.3, 999.7], [1000, 1000, 0], [1000, 1200, -200],
     ]);
     assert.ok(cartoes.every(({ faturas }) => faturas.length === 1));
     assert.deepEqual(cartoes[0].faturas[0].lancamentos, []);
     assert.equal(cartoes[0].faturas[0].total, 0);
     assert.equal(cartoes[1].faturas[0].total, 0.3);
     assert.equal(cartoes[3].faturas[0].total, 300);
     assert.deepEqual(cartoes[3].faturas[0].lancamentos.map(({ id, parcela }) => [id, parcela]), [
       [parcelas[0].id, '1/4'],
     ]);

     const padrao = (await prever()).corpo.cartoes.find(({ id }) => id === primeiroId + 3);
     assert.equal(padrao.faturas.length, 3);
     assert.equal(padrao.limiteUtilizado, 1200);
     const anual = (await prever('?meses=12')).corpo.cartoes.find(({ id }) => id === primeiroId + 3);
     assert.equal(anual.faturas.length, 12);
     assert.deepEqual(anual.faturas.map(({ total }) => total), [300, 300, 300, 300, ...Array(8).fill(0)]);
     assert.equal(anual.limiteUtilizado, 1200);
     assert.deepEqual((await prever('?meses=1&usuarioId=1', 2)).corpo.cartoes.map(({ id }) => id), [2]);
   });
   console.log('MySQL ' + version + ': CRUD, parcelamento, filtros e previsão de faturas verificados.');
  } finally {
    if (server) await new Promise(resolve=>server.close(resolve));
    await pool.promise().end();
    try {
      if (schemaCriado) await db.query('DROP DATABASE ??', [schema]);
    } finally {
      await db.end();
    }
  }
});
