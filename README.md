
# API de Controle Financeiro

Projeto acadêmico desenvolvido para a disciplina de Programação Web Back-end, com o objetivo de disponibilizar uma API REST para gerenciamento financeiro pessoal.

A aplicação permite cadastrar usuários, autenticar acessos, gerenciar categorias, fontes e destinos financeiros, registrar movimentações, parcelar compras e gerar relatórios financeiros.

Todos os recursos financeiros são protegidos por JWT e possuem isolamento de dados entre usuários.

## Tecnologias utilizadas

- Node.js — ambiente de execução JavaScript.
- Express — desenvolvimento da API REST.
- MySQL — banco de dados relacional.
- mysql2 — integração com o banco de dados.
- bcrypt — proteção de senhas por hash.
- jsonwebtoken — geração de tokens JWT.
- express-jwt — autenticação das rotas protegidas.
- dotenv — gerenciamento de variáveis de ambiente.
- nodemon — reinicialização automática durante o desenvolvimento.
- Node Test Runner — testes automatizados.

## Pré-requisitos

- Node.js 18 ou superior, preferencialmente uma versão LTS com suporte.
- npm.
- MySQL 8.0.16 ou superior.
- Git.
- Cliente HTTP, como Postman, Insomnia, Thunder Client ou curl.

## Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/miguelnsimoes/api-controle-financeiro.git
cd api-controle-financeiro
npm ci
```

## Variáveis de ambiente

Crie o arquivo `.env` a partir do `.env.example`.

No Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

No Linux ou macOS:

```bash
cp .env.example .env
```

Caso o arquivo `.env` já exista, preserve suas configurações.

Configure as seguintes variáveis:

```dotenv
PORT=3000
DB_HOST=127.0.0.1
DB_USER=usuario_exemplo
DB_PASSWORD=senha_exemplo
DB_NAME=api_financas
JWT_SECRET=substitua_por_um_segredo_seguro
```

Os valores apresentados são fictícios e devem ser substituídos pelas configurações locais.

O arquivo `.env` não deve ser versionado.

## Configuração do banco de dados

Certifique-se de que o MySQL esteja em execução.

Na raiz do projeto, acesse o cliente MySQL utilizando um usuário com as permissões necessárias:

```bash
mysql -h 127.0.0.1 -u root -p
```

Execute o script de criação:

```sql
SOURCE database/schema.sql;
```

O script cria o banco `api_financas` e suas quatro tabelas:

- `usuarios`
- `categorias`
- `fontes_destinos`
- `lancamentos`

O schema utiliza chaves estrangeiras, restrições UNIQUE, restrições CHECK e índices para garantir integridade e auxiliar nas consultas.

Execute o script somente em um banco novo, pois as tabelas não são recriadas automaticamente.

### Dados de demonstração

Para popular um banco recém-criado com dados fictícios:

```sql
USE api_financas;
SOURCE database/seed.sql;
```

O seed disponibiliza dois usuários, movimentações de três meses, categorias, contas, cartões de crédito e compras parceladas.

| Usuário | E-mail | Senha de demonstração |
| --- | --- | --- |
| A | demo.a@example.test | DemoFinancas123 |
| B | demo.b@example.test | DemoFinancas123 |

Essas credenciais são exclusivamente destinadas à demonstração.

Execute o seed apenas uma vez em um banco novo. Para reproduzir os resultados do roteiro de demonstração, utilize-o no mesmo dia UTC em que os dados foram carregados.

## Executando a aplicação

Modo de desenvolvimento:

```bash
npm run dev
```

Modo normal:

```bash
npm start
```

A aplicação verifica a conexão com o MySQL antes de iniciar o servidor HTTP.

Endereço padrão:

```text
http://localhost:3000
```

Caso a conexão falhe, confira as configurações do `.env`, a disponibilidade do MySQL e a existência do banco.

No PowerShell, caso a execução de `npm.ps1` esteja bloqueada, utilize `npm.cmd` no lugar de `npm`.

## Estrutura do projeto

```text
api-controle-financeiro/
├── database/
│   ├── connection.js
│   ├── schema.sql
│   └── seed.sql
├── docs/
│   ├── escopo-projeto.md
│   └── guia-contribuicao.md
├── middleware/
│   └── auth.js
├── models/
│   ├── Categoria.js
│   ├── FonteDestino.js
│   ├── Lancamento.js
│   ├── Relatorio.js
│   └── Usuario.js
├── routes/
│   ├── auth.js
│   ├── categorias.js
│   ├── fontes-destinos.js
│   ├── lancamentos.js
│   └── relatorios.js
├── testes/
│   ├── arquivos de testes automatizados
│   └── requisicoes.md
├── utils/
│   ├── cpf.js
│   ├── faturas.js
│   └── validarLancamento.js
├── .env.example
├── .gitignore
├── AGENTS.md
├── package.json
├── package-lock.json
├── README.md
└── server.js
```

### Organização da aplicação

- `database/`: conexão, estrutura e dados iniciais do banco.
- `models/`: acesso aos dados e operações SQL parametrizadas.
- `routes/`: endpoints, validações e respostas HTTP.
- `middleware/`: autenticação JWT.
- `utils/`: funções auxiliares e regras de negócio.
- `testes/`: testes automatizados e roteiro de requisições.
- `docs/`: documentação acadêmica e de colaboração.

## Autenticação

As rotas de cadastro e login são públicas. As demais rotas documentadas exigem um JWT válido.

Após realizar o login, envie o token no cabeçalho das requisições protegidas:

```http
Authorization: Bearer TOKEN_RECEBIDO_NO_LOGIN
Content-Type: application/json
```

O token utiliza o algoritmo HS256 e possui validade de uma hora.

O identificador do proprietário dos dados é obtido exclusivamente do token autenticado.

## Endpoints

### Autenticação e usuários

| Método | Endpoint | Descrição |
| --- | --- | --- |
| POST | `/auth/cadastro` | Cadastrar usuário |
| POST | `/auth/login` | Autenticar e gerar JWT |
| GET | `/auth/me` | Consultar perfil autenticado |

#### Cadastro

Exemplo de corpo JSON:

```json
{
  "nome": "Usuário de exemplo",
  "email": "usuario@example.com",
  "cpf": "529.982.247-25",
  "senha": "Exemplo123"
}
```

O cadastro valida os campos obrigatórios, o formato do e-mail, os dígitos verificadores do CPF e a senha.

A senha deve possuir pelo menos oito caracteres, incluindo letras e números, e não pode ultrapassar 72 bytes em UTF-8.

O e-mail e o CPF são normalizados antes da gravação. As restrições UNIQUE do banco impedem cadastros duplicados.

As senhas são armazenadas com bcrypt, utilizando custo 10.

O cadastro cria nove categorias padrão e uma conta corrente na mesma transação. Caso alguma operação falhe, todas são desfeitas.

#### Login

```json
{
  "email": "usuario@example.com",
  "senha": "Exemplo123"
}
```

O login retorna o token JWT e os dados públicos do usuário.

Credenciais incorretas retornam HTTP 401, sem informar se o e-mail existe.

### Categorias

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/categorias` | Listar categorias |
| POST | `/categorias` | Criar categoria |
| PUT | `/categorias/:id` | Atualizar categoria |
| DELETE | `/categorias/:id` | Excluir categoria |

Exemplo de criação:

```json
{
  "nome": "Transporte",
  "tipo": "saida"
}
```

Tipos disponíveis:

- `entrada`
- `saida`

A listagem aceita o filtro opcional `tipo`.

Categorias duplicadas para o mesmo usuário e tipo retornam HTTP 409.

Categorias com lançamentos vinculados não podem ser excluídas.

### Fontes e destinos

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/fontes-destinos` | Listar fontes e destinos |
| POST | `/fontes-destinos` | Criar fonte ou destino |
| PUT | `/fontes-destinos/:id` | Atualizar fonte ou destino |
| DELETE | `/fontes-destinos/:id` | Excluir fonte ou destino |

Tipos disponíveis:

- `renda`
- `conta`
- `cartao_credito`

Exemplo de criação de cartão:

```json
{
  "nome": "Cartão de exemplo",
  "tipo": "cartao_credito",
  "dia_fechamento": 10,
  "dia_vencimento": 17,
  "limite": 2000
}
```

A listagem aceita o filtro opcional `tipo`.

Cartões exigem dias de fechamento e vencimento entre 1 e 31 e limite positivo.

Registros duplicados ou com lançamentos vinculados, quando aplicável, retornam HTTP 409.

### Lançamentos

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/lancamentos` | Listar movimentações |
| GET | `/lancamentos/:id` | Consultar lançamento |
| POST | `/lancamentos` | Criar lançamento |
| PUT | `/lancamentos/:id` | Atualizar lançamento |
| DELETE | `/lancamentos/:id` | Excluir lançamento |

Exemplo de criação:

```json
{
  "tipo": "saida",
  "descricao": "Compra no supermercado",
  "valor": 150.00,
  "data": "2026-11-25",
  "categoriaId": 3,
  "fonteDestinoId": 1
}
```

Os identificadores devem corresponder a registros pertencentes ao usuário autenticado.

O valor deve ser positivo e a categoria deve possuir o mesmo tipo do lançamento.

#### Filtros e paginação

| Parâmetro | Descrição |
| --- | --- |
| `inicio` | Data inicial |
| `fim` | Data final |
| `tipo` | Entrada ou saída |
| `categoriaId` | Identificador da categoria |
| `fonteDestinoId` | Identificador da fonte ou destino |
| `pagina` | Página solicitada |

Exemplo:

```http
GET /lancamentos?inicio=2026-11-01&fim=2026-11-30&tipo=saida&pagina=1
```

A listagem possui paginação de 20 registros e resumo financeiro dos resultados filtrados. Na ausência de datas, considera o mês atual em UTC.

#### Parcelamento

Compras no cartão de crédito podem ser divididas em até 48 parcelas.

Para criar uma compra parcelada, informe o campo `parcelas`:

```json
{
  "tipo": "saida",
  "descricao": "Compra parcelada",
  "valor": 100.00,
  "data": "2026-11-25",
  "categoriaId": 3,
  "fonteDestinoId": 2,
  "parcelas": 3
}
```

O parcelamento utiliza transações e preserva o valor total da compra, distribuindo eventuais diferenças de centavos.

As parcelas são relacionadas por um identificador de grupo.

A exclusão pode atingir uma parcela individual ou todo o grupo por meio do parâmetro `todasParcelas=true`.

### Relatórios financeiros

Todos os relatórios utilizam exclusivamente os dados do usuário autenticado.

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/relatorios/categorias` | Relatório por categoria |
| GET | `/relatorios/fontes-destinos` | Relatório por fonte e destino |
| GET | `/relatorios/faturas` | Previsão de faturas |

#### Relatório por categoria

```http
GET /relatorios/categorias?inicio=2026-11-01&fim=2026-11-30
```

Apresenta:

- Totais de entradas e saídas.
- Valores agrupados por categoria.
- Participação percentual de cada categoria.
- Ordenação decrescente por valor.
- Comparação com o período anterior de mesma duração.
- Variação entre os períodos.

As datas inicial e final são obrigatórias.

#### Relatório por fonte e destino

```http
GET /relatorios/fontes-destinos?inicio=2026-11-01&fim=2026-11-30
```

Apresenta:

- Entradas agrupadas por fonte.
- Saídas agrupadas por destino.
- Totais financeiros por agrupamento.
- Saldos das contas.

O cálculo de saldo por conta considera registros do tipo `conta`.

As datas inicial e final são obrigatórias.

#### Previsão de faturas

```http
GET /relatorios/faturas?meses=3
```

Apresenta:

- Limite total do cartão.
- Limite utilizado.
- Limite disponível.
- Datas de fechamento e vencimento.
- Total de cada fatura.
- Lançamentos e parcelas associados.

O parâmetro `meses` aceita valores entre 1 e 12, com padrão 3.

A previsão considera a fatura aberta e as seguintes. O limite utilizado inclui parcelas que vencem além da janela solicitada.

Uma fatura fechada continua comprometendo o limite até o fim da data de vencimento em UTC.

O limite disponível pode ser negativo quando os gastos ultrapassam o limite total.

A aplicação não registra pagamentos de faturas. A liberação do limite por data é uma simplificação da regra de negócio e não confirma pagamento.

## Códigos de status HTTP

| Código | Significado | Utilização |
| --- | --- | --- |
| 200 | OK | Consultas e atualizações bem-sucedidas |
| 201 | Created | Criação de recursos |
| 204 | No Content | Exclusão bem-sucedida |
| 400 | Bad Request | Dados ou parâmetros inválidos |
| 401 | Unauthorized | Credenciais ou token inválidos |
| 404 | Not Found | Recurso inexistente ou de outro usuário |
| 409 | Conflict | Duplicidade ou conflito de integridade |
| 500 | Internal Server Error | Falha interna inesperada |

Os erros são retornados em JSON, sem exposição de consultas SQL, credenciais ou detalhes internos do banco.

## Segurança

A aplicação implementa:

- Autenticação JWT com expiração.
- Hash de senhas com bcrypt.
- Credenciais configuradas por variáveis de ambiente.
- Consultas SQL parametrizadas.
- Isolamento dos dados pelo identificador do usuário autenticado.
- Validação de dados no servidor.
- Restrições de integridade no banco.
- Transações com rollback em operações compostas.
- Tratamento de erros sem exposição de informações internas.

Recursos pertencentes a outros usuários retornam HTTP 404, evitando revelar sua existência.

## Requisitos funcionais

| Requisito | Descrição | Status |
| --- | --- | --- |
| RF1 | Cadastro de usuário | Implementado |
| RF2 | Login | Implementado |
| RF3 | Isolamento dos dados entre usuários | Implementado |
| RF4 | CRUD de categorias | Implementado |
| RF5 | CRUD de fontes e destinos | Implementado |
| RF6 | CRUD de lançamentos | Implementado |
| RF7 | Relatório por categoria | Implementado |
| RF8 | Relatório por fonte e destino | Implementado |
| RF9 | Previsão de faturas de cartão de crédito | Implementado |

Os nove requisitos obrigatórios foram validados por testes automatizados, incluindo integração com MySQL real.

## Testes automatizados

Execute:

```bash
npm test
```

Os testes utilizam o executor nativo do Node.js e abrangem autenticação, validações, transações, isolamento de dados, operações CRUD, parcelamento e relatórios.

### Testes com MySQL real

Para executar também os testes de integração, utilize uma instância MySQL isolada e um usuário autorizado a criar schemas e triggers.

No PowerShell:

```powershell
$env:TESTE_MYSQL_REAL = "1"
npm.cmd test
```

No Linux ou macOS:

```bash
TESTE_MYSQL_REAL=1 npm test
```

Configure as credenciais da instância de testes por meio das variáveis de ambiente correspondentes.

Os testes de integração utilizam schemas temporários e não devem ser executados em bancos de produção.

### Resultado da validação

Validação realizada em 25/11/2026, utilizando MySQL 8.4.9:

| Execução | Total | Aprovados | Falhas | Ignorados |
| --- | ---: | ---: | ---: | ---: |
| Testes padrão | 95 | 93 | 0 | 2 |
| Testes com MySQL real | 97 | 97 | 0 | 0 |

## Demonstração da API

O roteiro completo de requisições HTTP, incluindo dados de demonstração e resultados esperados, está disponível em:

[testes/requisicoes.md](testes/requisicoes.md)

O roteiro permite demonstrar cadastro, login, isolamento entre usuários, operações CRUD, parcelamento e relatórios financeiros.

## Equipe e responsabilidades

| Integrante | Responsabilidades |
| --- | --- |
| Miguel Simões | Estrutura inicial, modelagem do banco, autenticação, segurança, categorias, fontes e destinos. |
| Daniel Kawata Hara | Lançamentos, parcelamento, filtros, paginação, previsão de faturas, seed e testes integrados. |
| Yaron Buchler | Relatórios por categoria, relatórios por fontes e destinos, revisão e documentação final. |

## Fluxo de colaboração

- `main`: versão estável do projeto.
- `develop`: integração das funcionalidades.
- `feature/*`: desenvolvimento de funcionalidades.
- `docs/*`: alterações de documentação.

As alterações são integradas por Pull Requests e revisão dos integrantes da equipe.

## Documentação complementar

- [Escopo oficial do projeto](docs/escopo-projeto.md)
- [Guia de contribuição](docs/guia-contribuicao.md)
- [Roteiro de requisições HTTP](testes/requisicoes.md)
- [Instruções para agentes](AGENTS.md)
