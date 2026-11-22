# API Controle Financeiro

Projeto acadêmico de uma API REST para gerenciamento financeiro pessoal. Estão implementados o servidor Express, o banco MySQL, o cadastro de usuários com dados padrão e o login com JWT.

## Tecnologias

- Node.js com CommonJS (`require` / `module.exports`).
- Express para o servidor HTTP.
- MySQL com o driver mysql2 para conexão com o banco de dados.
- bcrypt para proteger as senhas com hash.
- jsonwebtoken para emitir tokens de login.
- express-jwt para validar tokens nas rotas protegidas.
- dotenv para carregar variáveis de ambiente.
- nodemon para reiniciar o servidor durante o desenvolvimento.

## Pré-requisitos

- Node.js 18 ou superior, compatível com Express 5 (preferencialmente uma versão LTS com suporte).
- npm.
- MySQL 8.0.16 ou superior em execução (validado localmente no MySQL 8.4.13).
- Git para clonar o repositório.

## Instalação

```bash
git clone https://github.com/miguelnsimoes/api-controle-financeiro.git
cd api-controle-financeiro
npm ci
```

## Variáveis de ambiente

Copie `.env.example` para `.env` na raiz do projeto. No PowerShell:

```powershell
Copy-Item .env.example .env
```

No Linux ou macOS:

```bash
cp .env.example .env
```

Ajuste os valores locais. `PORT` define a porta HTTP, com fallback para `3000` quando ausente. `DB_HOST`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` configuram a conexão MySQL. Use `DB_NAME=api_financas` e informe um usuário e senha válidos do seu MySQL local. Defina `JWT_SECRET` com um segredo local para assinar os tokens de login; não versione esse segredo.

O arquivo de exemplo contém valores fictícios. Não versione o `.env` nem credenciais reais.

## Preparação do banco

Se o banco ainda não tiver sido criado, abra o cliente MySQL com seu usuário a partir da raiz do projeto e execute:

```sql
SOURCE database/schema.sql;
```

O script cria `api_financas` e suas quatro tabelas. Execute-o somente na criação inicial: ele não recria ou atualiza tabelas existentes.

## Execução

Iniciar o servidor:

```bash
npm start
```

Iniciar em desenvolvimento, com reinicialização automática:

```bash
npm run dev
```

O terminal exibirá `Conexão com MySQL estabelecida.` e depois `Servidor iniciado na porta 3000` ou a porta configurada em `PORT`. O servidor HTTP inicia após a confirmação da conexão. Se a conexão falhar, o processo encerra com código 1 e informa o código do erro MySQL, sem exibir credenciais. Confira o serviço MySQL, o banco criado e as variáveis do `.env`. Para encerrar, pressione `Ctrl+C`.

A rota `/` permanece sem implementação e retorna HTTP 404. A rota de cadastro está descrita abaixo.

## Cadastro de usuários

Envie `POST /auth/cadastro` com `Content-Type: application/json`:

```json
{
  "nome": "Usuário de exemplo",
  "email": "usuario@example.com",
  "cpf": "529.982.247-25",
  "senha": "Exemplo123"
}
```

Os valores acima são apenas exemplos. Nome, e-mail, CPF e senha são obrigatórios. O CPF deve ter dígitos verificadores válidos; a senha deve ter ao menos oito caracteres, com letras e números. Para respeitar o limite do bcrypt, senhas acima de 72 bytes em UTF-8 são rejeitadas, em vez de serem truncadas. Nome aceita até 120 caracteres e e-mail até 160, conforme o schema.

O cadastro remove espaços nas extremidades do nome e do e-mail, converte o e-mail para minúsculas e grava o CPF somente com dígitos. A senha é armazenada como hash bcrypt com custo 10 e nunca é devolvida pela API.

Um cadastro válido retorna `201` com `id`, `nome` e `email`. Dados inválidos retornam `400` com `erro` e `campos`; e-mail ou CPF duplicado retorna `409`, identificando o campo. Erros inesperados retornam `500` com mensagem genérica.

Na mesma transação, são criadas nove categorias (duas de entrada e sete de saída) e a fonte/destino “Conta corrente”. Uma falha desfaz todas as inserções. O pool reserva uma conexão exclusiva para cada transação, liberando-a ao finalizar.

Veja os exemplos executáveis em [testes/requisicoes.md](testes/requisicoes.md).

## Login

Envie `POST /auth/login` com `Content-Type: application/json` e o e-mail e senha de um usuário cadastrado:

```json
{
  "email": "usuario@example.com",
  "senha": "Exemplo123"
}
```

O e-mail é normalizado antes da consulta e a senha é conferida com `bcrypt.compare`. No sucesso, a resposta `200` contém `token` e `usuario` (somente `id`, `nome` e `email`). O JWT é assinado com `JWT_SECRET` e expira em uma hora; a senha e seu hash não aparecem na resposta nem no token.

E-mail inexistente ou senha incorreta retornam o mesmo `401` com `erro: "E-mail ou senha inválidos."`. Campos ausentes ou com tipos incorretos retornam `400`. Falhas internas retornam `500` sem detalhes técnicos ao cliente. Configure `JWT_SECRET` antes de iniciar a aplicação: o middleware de proteção exige esse segredo durante a inicialização.

## Perfil do usuário autenticado

Envie `GET /auth/me` com o token recebido no login:

```http
Authorization: Bearer TOKEN_RECEBIDO_NO_LOGIN
```

O middleware de `middleware/auth.js`, seguindo o exemplo do roteiro, verifica a assinatura com `JWT_SECRET`, o algoritmo `HS256` e a validade do token. A rota usa `req.auth.id` para consultar o usuário no banco e retorna `200` com apenas `id`, `nome` e `email` atuais. IDs fornecidos na query não selecionam outro usuário.

Token ausente, inválido ou expirado retorna `401` em JSON. Se o usuário do token não existir mais no banco, a rota retorna `404`.

## Proteção dos recursos financeiros — Issue #6 em andamento

Os caminhos `/categorias`, `/fontes-destinos`, `/lancamentos` e `/relatorios` passam pelo middleware JWT no `server.js`, em todos os métodos HTTP. Sem token válido, retornam `401` em JSON. Cadastro e login continuam públicos, e `/auth/me` mantém sua proteção individual.

O CRUD de categorias está implementado: `GET /categorias`, `POST /categorias`, `PUT /categorias/:id` e `DELETE /categorias/:id`. Essas operações, a listagem de fontes e destinos e o relatório em `GET /relatorios/categorias` usam o proprietário do token. Os endpoints de lançamentos ainda não estão implementados.

Nas Issues dos CRUDs, os respectivos Routers devem ser registrados **depois da proteção JWT e antes do tratador de 404**. Para concluir a Issue #6, será necessário aplicar e testar estas regras:

- Obter o proprietário de `req.auth.id`, ignorando IDs de usuário enviados pelo cliente.
- Filtrar listagens por `usuario_id` e consultas de registros por `id` e `usuario_id` juntos, com SQL parametrizado nas classes de `models/`.
- Aplicar o filtro de proprietário também em alterações e exclusões, retornando `404` para registros inexistentes ou de outro usuário.
- Antes de criar ou editar um lançamento, confirmar que a categoria e a fonte/destino pertencem ao mesmo usuário autenticado.
- Testar as operações com dois usuários distintos, garantindo que nenhum consulte, altere ou exclua registros do outro.

Esses pontos dependem das Issues #7 (categorias), #8 (fontes/destinos) e #9 (lançamentos). A Issue #6 deve permanecer em andamento até a implementação e validação do isolamento nesses recursos.

## Listagem de categorias — Issue #7 em andamento

Envie `GET /categorias` com `Authorization: Bearer TOKEN_RECEBIDO_NO_LOGIN`. A resposta `200` contém um array com `id`, `nome` e `tipo` das categorias do usuário autenticado. Sem categorias, retorna `[]`.

O filtro `GET /categorias?tipo=entrada` ou `GET /categorias?tipo=saida` é opcional. Um valor informado diferente dessas opções retorna `400` com mensagem em `campos.tipo`.

A rota usa exclusivamente `req.auth.id` como proprietário, ignorando IDs de usuário enviados na query. O model `Categoria.listar()` aplica `WHERE usuario_id = ?` e, quando necessário, `AND tipo = ?`, com parâmetros separados do SQL. Sem JWT válido, a resposta é `401`.

## Criação de categorias — Issue #7 em andamento

Envie `POST /categorias` com o token do login e `Content-Type: application/json`:

```json
{
  "nome": "Transporte",
  "tipo": "saida"
}
```

Nome é obrigatório e tem espaços das extremidades removidos. Tipo deve ser `entrada` ou `saida`. Dados inválidos retornam `400`; sucesso retorna `201` com `id`, `nome` e `tipo`.

O proprietário é obtido de `req.auth.id`, ignorando IDs enviados no corpo. O MySQL impede nome repetido para o mesmo usuário e tipo, e a API responde `409` com mensagem em `campos.nome`. O mesmo nome pode existir para outro usuário ou para outro tipo.

## Atualização de categorias — Issue #7 em andamento

Envie `PUT /categorias/:id` com JWT válido e um JSON contendo `nome` e `tipo`, seguindo as mesmas validações da criação. O ID da categoria vem da URL e o proprietário vem exclusivamente de `req.auth.id`.

O model atualiza com `WHERE id = ? AND usuario_id = ?`. No sucesso, retorna `200` com `id`, `nome` e `tipo`, inclusive ao repetir os mesmos valores. Categoria inexistente ou pertencente a outro usuário retorna `404`, sem indicar a existência de dados de terceiros. Dados ou identificador inválidos retornam `400`, e nome duplicado para o mesmo usuário e tipo retorna `409`.

## Exclusão de categorias

Envie `DELETE /categorias/:id` com JWT válido. O model executa `DELETE FROM categorias WHERE id = ? AND usuario_id = ?`, usando o proprietário do token. A exclusão bem-sucedida retorna `204` sem corpo.

ID inválido retorna `400`; categoria inexistente ou de outro usuário retorna `404`. A chave estrangeira de `lancamentos.categoria_id` impede excluir uma categoria com lançamentos vinculados. Nessa situação, a API retorna `409` com mensagem explicativa, preservando a categoria e os lançamentos.

O CRUD da Issue #7 está implementado e validado. A conclusão da Issue no fluxo da equipe depende da revisão, integração por PR e validação em `develop`. O restante do isolamento da Issue #6 continua dependendo dos demais recursos financeiros.

## Listagem de fontes e destinos

Envie `GET /fontes-destinos` com `Authorization: Bearer TOKEN_RECEBIDO_NO_LOGIN`. A resposta `200` contém apenas os registros do usuário autenticado. Sem registros, a resposta é `[]`.

Use `?tipo=renda`, `?tipo=conta` ou `?tipo=cartao_credito` para filtrar. Um tipo inválido retorna `400`. Sem JWT válido, a resposta é `401`.

## Criação de fontes e destinos

Envie `POST /fontes-destinos` com o JWT do login e um JSON como `{"nome":"Conta corrente","tipo":"conta"}`. Para `cartao_credito`, inclua `dia_fechamento` e `dia_vencimento` como inteiros de 1 a 31 e `limite` como valor numérico de pelo menos um centavo.

A criação retorna `201` com o registro criado. Dados inválidos retornam `400` e nome duplicado para o mesmo usuário retorna `409`, mesmo entre tipos diferentes.

## Testes

```bash
npm test
```

Os testes usam o executor nativo do Node.js e cobrem CPF, transações de cadastro, consultas de usuário, login e perfil protegido. Os testes HTTP usam bcrypt e JWT reais, com consultas ao banco simuladas, verificando respostas, assinatura, expiração e uso do ID do token. `auth-recursos.test.js` testa a aplicação exportada pelo próprio `server.js`, incluindo proteção dos caminhos financeiros, acesso público a cadastro/login e erros JSON. Não gravam dados no MySQL nem demonstram isolamento de CRUDs ainda inexistentes. No PowerShell, se a política local bloquear `npm.ps1`, use `npm.cmd test` e `npm.cmd run dev`.

Ao executar `node server.js` ou os scripts npm, a aplicação testa a conexão MySQL e inicia o servidor normalmente. Ao importar `server.js` nos testes, `require.main === module` é falso: o arquivo apenas exporta a aplicação Express, permitindo testá-la sem iniciar outra conexão com o banco.

## Estrutura inicial

```text
api-controle-financeiro/
├── database/
│   ├── .gitkeep
│   ├── connection.js
│   └── schema.sql
├── middleware/
│   ├── .gitkeep
│   └── auth.js
├── models/
│   ├── .gitkeep
│   ├── Categoria.js
│   └── Usuario.js
├── routes/
│   ├── .gitkeep
│   ├── auth.js
│   └── categorias.js
├── utils/
│   ├── .gitkeep
│   └── cpf.js
├── testes/
│   ├── .gitkeep
│   ├── auth-login.test.js
│   ├── auth-perfil.test.js
│   ├── auth-recursos.test.js
│   ├── categoria.test.js
│   ├── categorias-http.test.js
│   ├── cpf.test.js
│   ├── usuario-login.test.js
│   ├── usuario.test.js
│   └── requisicoes.md
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── server.js
```

Os arquivos `.gitkeep` preservam os diretórios iniciais. O SQL de usuários fica em `models/Usuario.js`, e o de categorias em `models/Categoria.js`. Os arquivos de `routes/` validam as entradas e montam as respostas. O middleware JWT protege os caminhos financeiros e a rota de perfil, mantendo cadastro e login públicos.

## Fluxo de colaboração

As funcionalidades são desenvolvidas em branches `feature/*`, com Pull Request para `develop` e aprovação de outro integrante. A branch `main` contém a versão estável.

## Documentação da equipe

- [Instruções para agentes Codex](AGENTS.md)
- [Guia de contribuição](docs/guia-contribuicao.md)
- [Escopo oficial do projeto](docs/escopo-projeto.md)
