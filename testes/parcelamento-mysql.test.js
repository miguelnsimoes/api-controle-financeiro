const assert = require('node:assert/strict');
const fs = require('node:fs');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

// Execute com TESTE_MYSQL_REAL=1 e DB_HOST, DB_USER e DB_PASSWORD de uma instância de testes.
test('parcelamento por HTTP com MySQL real', { skip: process.env.TESTE_MYSQL_REAL !== '1' }, async () => {
  const schema = 'teste_parcelamento_' + randomUUID().replaceAll('-', '');
  process.env.DB_NAME = schema;
  process.env.JWT_SECRET = 'segredo_ficticio_para_teste_mysql';
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
  const app = require('../server');
  const pool = require('../database/connection');
  let server;
  try {
   const [[{version}]] = await db.query('SELECT VERSION() AS version');
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
   assert.deepEqual(await req('GET','',200,undefined,2),[]);
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
   assert.equal((await req('GET','',200)).length,2);
   await req('DELETE','/'+parcelas[1].id+'?todasParcelas=true',204);
   assert.deepEqual(await req('GET','',200),[]);
   assert.equal((await req('GET','',200,undefined,2)).length,1);
   await req('DELETE','/'+outro[0].id+'?todasParcelas=true',204,undefined,2);
   const max = await req('POST','',201,{...data,valor:0.48,parcelas:48});
   assert.equal(max.length,48);
   assert.ok(max.every(p=>p.valor===0.01));
   await req('DELETE','/'+max[0].id+'?todasParcelas=true',204);
   const concorrentes = await Promise.all([3, 4].map(q => req('POST','',201,{...data,parcelas:q})));
   const [grupos] = await db.query('SELECT COUNT(DISTINCT grupo_parcelamento) AS total FROM lancamentos');
   assert.equal(grupos[0].total,2);
   await req('DELETE','/'+concorrentes[0][0].id+'?todasParcelas=true',204);
   assert.equal((await req('GET','',200)).length,4);
   await req('DELETE','/'+concorrentes[1][0].id+'?todasParcelas=true',204);
  const corrida = await req('POST', '', 201, {...data, parcelas: 3});
  const statusExclusoes = await Promise.all([
    req('DELETE', '/' + corrida[0].id + '?todasParcelas=true', [204, 404]),
    req('DELETE', '/' + corrida[1].id + '?todasParcelas=true', [204, 404]),
  ]);
  assert.deepEqual(statusExclusoes.sort(), [204, 404]);
  assert.deepEqual(await req('GET', '', 200), []);
   await db.query("CREATE TRIGGER falhar_segunda_parcela BEFORE INSERT ON lancamentos FOR EACH ROW BEGIN IF NEW.parcela_atual = 2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falha de teste'; END IF; END");
   assert.deepEqual(await req('POST','',500,{...data,parcelas:3}),{erro:'Erro interno do servidor.'});
   const [[{total}]] = await db.query('SELECT COUNT(*) AS total FROM lancamentos');
   assert.equal(total,0);
   console.log('MySQL '+version+': CRUD, JWT, isolamento, validacoes, 1/3/48 parcelas, UUID, datas, exclusoes e rollback confirmados.');
  } finally {
    if (server) await new Promise(resolve=>server.close(resolve));
    await pool.promise().end();
    try {
      await db.query('DROP DATABASE IF EXISTS ??', [schema]);
    } finally {
      await db.end();
    }
  }
});
