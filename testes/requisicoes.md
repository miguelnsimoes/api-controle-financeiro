# Roteiro HTTP da API

Use uma instância MySQL descartável, com o banco `api_financas` ainda inexistente. A partir da raiz, instale com `npm ci`, copie `.env.example` para `.env` e configure as credenciais da instância isolada e um `JWT_SECRET` local. No cliente MySQL dessa instância, execute:

```sql
SOURCE database/schema.sql;
USE api_financas;
SOURCE database/seed.sql;
```

Execute o seed uma vez por banco vazio. Ele cria dois usuários fictícios, cada um com uma conta, um cartão, categorias e movimentos em três meses, calculados em UTC na carga. As senhas abaixo são públicas e exclusivas da demonstração. Use um segredo JWT diferente dessas senhas. Inicie com `npm run dev` e execute os exemplos no mesmo dia UTC em que carregou o seed. Para repetir o roteiro inteiro ou demonstrar em outra data, carregue os scripts numa nova instância descartável.

| Conta | Login | Senha de demonstração |
|---|---|---|
| A | `demo.a@example.test` | `DemoFinancas123` |
| B | `demo.b@example.test` | `DemoFinancas123` |

## Cliente e autenticação

Os blocos seguintes são sequenciais no PowerShell 7. A função verifica o status e devolve o JSON. Troque a porta se a sua API estiver em outra.

```powershell
$api = 'http://127.0.0.1:3000'
function Api($codigo, $metodo, $rota, $token, $dados) {
  $opcoes = @{
    Uri = "$api$rota"; Method = $metodo; SkipHttpErrorCheck = $true
    StatusCodeVariable = 'status'
  }
  if ($token) { $opcoes.Headers = @{ Authorization = "Bearer $token" } }
  if ($null -ne $dados) {
    $opcoes.ContentType = 'application/json; charset=utf-8'
    $opcoes.Body = ConvertTo-Json -InputObject $dados -Compress
  }
  $resultado = Invoke-RestMethod @opcoes
  if ($status -ne $codigo) { throw "$metodo ${rota}: esperado $codigo, recebido $status" }
  $resultado
}
$senha = 'DemoFinancas123'
$c = @{ nome = 'Pessoa Demo C'; email = 'demo.c@example.test'; cpf = '900.000.002-56'; senha = $senha }
Api 201 POST /auth/cadastro $null $c
Api 409 POST /auth/cadastro $null @{ nome = $c.nome; email = ' DEMO.C@EXAMPLE.TEST '; cpf = '90000000337'; senha = $senha }
Api 409 POST /auth/cadastro $null @{ nome = $c.nome; email = 'outro@example.test'; cpf = '90000000256'; senha = $senha }
Api 400 POST /auth/cadastro $null @{ nome = ''; email = 'invalido'; cpf = '00000000000'; senha = 'curta' }
Api 401 POST /auth/login $null @{ email = 'demo.a@example.test'; senha = 'Incorreta123' }
$a = (Api 200 POST /auth/login $null @{ email = ' DEMO.A@EXAMPLE.TEST '; senha = $senha }).token
$b = (Api 200 POST /auth/login $null @{ email = 'demo.b@example.test'; senha = $senha }).token
Api 200 GET /auth/me $a
Api 401 GET /auth/me
Api 401 GET /categorias 'token-invalido'
Api 404 GET /rota-inexistente $a
```

Cadastro e perfil devolvem `id`, `nome` e `email`. Login devolve `{"token":"…","usuario":{"id":1,"nome":"Pessoa Demo A","email":"demo.a@example.test"}}`, com ID variável e token válido por uma hora. A primeira duplicidade inclui `campos.email` e a segunda, `campos.cpf`. Credencial inválida responde `{"erro":"E-mail ou senha inválidos."}`. Token ausente, inválido ou expirado responde `{"erro":"Token ausente, inválido ou expirado."}`. Para repetir a expiração sem aguardar uma hora, execute os testes automatizados.

## Categorias e fontes/destinos

```powershell
$compras = Api 200 GET '/categorias?tipo=saida' $a | Where-Object nome -eq 'Compras Demo A'
$cartao = Api 200 GET '/fontes-destinos?tipo=cartao_credito' $a | Where-Object nome -eq 'Cartão Demo A'
$cat = @{ nome = 'Categoria temporária'; tipo = 'saida' }
$fonte = @{ nome = 'Conta temporária'; tipo = 'conta' }
foreach ($caso in @(
  @{ rota = '/categorias'; dados = $cat },
  @{ rota = '/fontes-destinos'; dados = $fonte }
)) {
  $rota = $caso.rota
  $item = Api 201 POST $rota $a $caso.dados
  $id = $item.id
  $alteracao = @{ nome = 'Temporária atualizada'; tipo = $caso.dados.tipo }
  Api 409 POST $rota $a $caso.dados
  Api 400 GET "${rota}?tipo=invalido" $a
  Api 200 GET $rota $b
  Api 404 PUT "$rota/$id" $b $alteracao
  Api 404 DELETE "$rota/$id" $b
  Api 200 PUT "$rota/$id" $a $alteracao
  Api 204 DELETE "$rota/$id" $a
}
Api 400 POST /fontes-destinos $a @{ nome = 'Cartão incompleto'; tipo = 'cartao_credito' }
Api 409 DELETE "/categorias/$($compras.id)" $a
Api 409 DELETE "/fontes-destinos/$($cartao.id)" $a
```

As listagens devolvem arrays com registros do dono do token. A lista de B deve excluir os itens temporários de A. Para categorias, criação e atualização devolvem `{"id":7,"nome":"Categoria temporária","tipo":"saida"}` com ID variável. Fontes/destinos também incluem os campos de cartão, nulos para contas. Exclusão com `204` tem corpo vazio. O `409` por vínculo mantém o registro e os lançamentos.

## Lançamentos, parcelamento e paginação

```powershell
$utc = [DateTime]::UtcNow
$hoje = $utc.ToString('yyyy-MM-dd')
$inicio = $utc.ToString('yyyy-MM-01')
$periodo = "inicio=$inicio&fim=$hoje"
$compra = @{
  tipo = 'saida'; descricao = 'Compra temporária'; valor = 100; data = $hoje
  categoriaId = $compras.id; fonteDestinoId = $cartao.id
}
Api 401 GET /lancamentos
Api 200 GET /lancamentos $a
$base = Api 200 GET "/lancamentos?$periodo" $a
$alheio = "/lancamentos/$($base.itens[0].id)"
Api 404 GET $alheio $b
Api 404 PUT $alheio $b $compra
Api 404 DELETE $alheio $b
Api 404 POST /lancamentos $b $compra
$invalida = $compra.Clone()
$invalida.tipo = 'entrada'
Api 400 POST /lancamentos $a $invalida
$simples = Api 201 POST /lancamentos $a $compra
Api 200 GET "/lancamentos/$($simples.id)" $a
$editada = $compra.Clone()
$editada.valor = 101
Api 200 PUT "/lancamentos/$($simples.id)" $a $editada
Api 204 DELETE "/lancamentos/$($simples.id)" $a
$parcelas = @(Api 201 POST /lancamentos $a ($compra + @{ parcelas = 3 }))
$parcelas | Select-Object parcela, valor
Api 204 DELETE "/lancamentos/$($parcelas[1].id)?todasParcelas=false" $a
Api 204 DELETE "/lancamentos/$($parcelas[0].id)?todasParcelas=true" $a
Api 404 GET "/lancamentos/$($parcelas[2].id)" $a
$paginaCompra = $compra.Clone()
$paginaCompra.valor = 23
$lote = @(Api 201 POST /lancamentos $a ($paginaCompra + @{ parcelas = 23 }))
$filtro = "$periodo&tipo=saida&categoriaId=$($compras.id)&fonteDestinoId=$($cartao.id)"
$pagina1 = Api 200 GET "/lancamentos?$filtro&pagina=1" $a
$pagina2 = Api 200 GET "/lancamentos?$filtro&pagina=2" $a
if ($pagina1.itens.Count -ne 20 -or $pagina2.itens.Count -ne 6) {
  throw 'A paginação deveria retornar 20 itens na primeira página e 6 na segunda.'
}
foreach ($pagina in @($pagina1, $pagina2)) {
  if ($pagina.totalPaginas -ne 2 -or $pagina.resumo.saidas -ne 123 -or $pagina.resumo.saldo -ne -123) {
    throw 'Os totais precisam considerar todos os lançamentos filtrados.'
  }
}
Api 400 GET '/lancamentos?pagina=0' $a
Api 204 DELETE "/lancamentos/$($lote[0].id)?todasParcelas=true" $a
```

- Sem datas, a API usa o mês corrente UTC. Antes das escritas do roteiro, o resumo de A é `{"entradas":3200,"saidas":350,"saldo":2850}`.
- A compra simples retorna um objeto com `id`, `tipo`, `descricao`, `valor`, `data`, `categoria`, `fonteDestino` e `parcela`. A parcelada retorna três objetos, com `1/3`, `2/3`, `3/3` e valores `33.34`, `33.33`, `33.33`, mantendo a data da compra.
- O filtro combinado deve devolver `totalPaginas: 2`, 20 itens na primeira e 6 na segunda. Ambas resumem `{"entradas":0,"saidas":123,"saldo":-123}` antes da remoção do lote.
- O `400` por tipo incompatível inclui `campos.categoriaId`. Os `404` de leitura, alteração e exclusão devem ter a mesma resposta de registro inexistente.

## Três relatórios

```powershell
foreach ($demo in @(
  @{ token = $a; letra = 'A'; entrada = 3200; saida = 350; saldo = 2950; valores = @(33.34, 33.33, 33.33); limite = 100 },
  @{ token = $b; letra = 'B'; entrada = 1600; saida = 45; saldo = 1600; valores = @(45, 0, 0); limite = 45 }
)) {
  $categorias = Api 200 GET "/relatorios/categorias?$periodo" $demo.token
  $fontes = Api 200 GET "/relatorios/fontes-destinos?$periodo" $demo.token
  $faturas = Api 200 GET '/relatorios/faturas?meses=3' $demo.token
  $cartoes = @($faturas.cartoes)
  if ($categorias.entradas.total -ne $demo.entrada -or $categorias.saidas.total -ne $demo.saida -or
      @($fontes.contas).Count -ne 1 -or $fontes.contas[0].saldo -ne $demo.saldo -or
      $cartoes.Count -ne 1 -or $cartoes[0].nome -ne "Cartão Demo $($demo.letra)" -or
      $cartoes[0].limiteUtilizado -ne $demo.limite -or @($cartoes[0].faturas).Count -ne 3) {
    throw "Relatórios inesperados para a conta $($demo.letra)."
  }
  for ($i = 0; $i -lt 3; $i++) {
    if ($cartoes[0].faturas[$i].total -ne $demo.valores[$i]) {
      throw "Total incorreto na fatura de referência $($cartoes[0].faturas[$i].referencia)."
    }
  }
  $categorias
  $fontes
  $faturas
}
Api 400 GET '/relatorios/categorias?inicio=2026-02-30' $a
Api 400 GET /relatorios/fontes-destinos $a
Api 400 GET '/relatorios/faturas?meses=13' $a
Api 401 GET '/relatorios/faturas?meses=3'
```

| Relatório | Resposta esperada para A | Resposta esperada para B |
|---|---|---|
| Categorias | `entradas.total: 3200`, `saidas.total: 350`. Compras Demo A tem 100% das saídas. Há `periodoAnterior`, `anterior` e `variacao` | `entradas.total: 1600`, `saidas.total: 45`. Apenas categorias de B |
| Fontes/destinos | `contas[0].saldo: 2950`. Saídas da conta somam 250 e as do cartão, 100 | `contas[0].saldo: 1600`. Saídas do cartão somam 45 |
| Faturas | Apenas Cartão Demo A, três faturas com totais `33.34, 33.33, 33.33` e parcelas `1/3, 2/3, 3/3`. Limites total, utilizado e disponível `2000, 100, 1900` | Apenas Cartão Demo B, totais `45, 0, 0` e limites `1000, 45, 955` |

Cada fatura devolve `referencia` no formato `AAAA-MM`, `fechamento`, `vencimento`, `total` e `lancamentos`. Para demonstrar a regra do fechamento de A, crie duas compras simples no cartão, uma no dia 14 e outra no dia 15 do mês corrente. A primeira fecha no dia 15 daquele mês e a segunda no mesmo dia do mês seguinte. Confira com a janela correspondente ou com os testes automatizados quando o ciclo anterior já tiver fechado.


## Saúde financeira — Issue #17

### Consultar indicadores e projeções

```http
GET /saude-financeira
Authorization: Bearer <TOKEN>
```

Resultados esperados:

- HTTP 200 com token válido.
- HTTP 401 com token ausente, inválido ou expirado.
- HTTP 500 em caso de falha interna, sem exposição de detalhes SQL.

A resposta HTTP 200 contém:

- `aviso`: aviso educativo obrigatório.
- `mesReferencia`: mês atual no formato AAAA-MM.
- `indicadores.taxaPoupanca`: proporção ou null.
- `indicadores.comprometimentoCartoes`: proporção ou null.
- `indicadores.totalParcelasFuturas`: valor monetário.
- `indicadores.parcelasPorMes`: parcelas agrupadas por vencimento.
- `projecao`: seis meses de estimativas financeiras.
- `dicas`: mensagens educativas baseadas nos indicadores.

### Verificação de isolamento

Realizar a consulta com tokens de dois usuários distintos e verificar que cada resposta considera exclusivamente os lançamentos do proprietário do token.

Parâmetros como `usuario_id` e `usuarioId` não alteram o proprietário da consulta.

### Testes automatizados específicos

```bash
node --test testes/saude-financeira-model.test.js testes/saude-financeira.test.js
```

## Suíte automatizada

`npm test` roda os testes padrão sem precisar de segredo JWT externo ou banco. Para incluir MySQL real, aponte apenas para uma instância isolada com permissão para criar schemas e triggers. Exemplo em PowerShell:

```powershell
$env:TESTE_MYSQL_REAL = '1'
$env:DB_HOST = '127.0.0.1'
$env:DB_USER = 'usuario_da_instancia_de_teste'
$env:DB_PASSWORD = 'senha_da_instancia_de_teste'
npm.cmd test
```

Os testes integrados criam schemas temporários de nome único. O cenário de entrega aplica `schema.sql` e `seed.sql`, usa logins reais, verifica os dois proprietários, testa os CRUDs, o parcelamento e confere valores dos três relatórios. O cenário de parcelamento também cobre concorrência, rollback e casos de borda.
