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

## Testes

```bash
npm test
```

Os testes usam o executor nativo do Node.js e cobrem CPF, transações de cadastro, consultas de usuário, login e perfil protegido. Os testes HTTP usam bcrypt e JWT reais, com consultas ao banco simuladas, verificando respostas, assinatura, expiração e uso do ID do token. Não gravam dados no MySQL. No PowerShell, se a política local bloquear `npm.ps1`, use `npm.cmd test` e `npm.cmd run dev`.

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
│   └── Usuario.js
├── routes/
│   ├── .gitkeep
│   └── auth.js
├── utils/
│   ├── .gitkeep
│   └── cpf.js
├── testes/
│   ├── .gitkeep
│   ├── auth-login.test.js
│   ├── auth-perfil.test.js
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

Os arquivos `.gitkeep` preservam os diretórios iniciais. O SQL de cadastro e consulta de usuários fica em `models/Usuario.js`; `routes/auth.js` valida as entradas e monta as respostas. O middleware JWT de `middleware/auth.js` protege individualmente a rota de perfil, mantendo cadastro e login públicos.

## Fluxo de colaboração

As funcionalidades são desenvolvidas em branches `feature/*`, com Pull Request para `develop` e aprovação de outro integrante. A branch `main` contém a versão estável.

## Documentação da equipe

- [Instruções para agentes Codex](AGENTS.md)
- [Guia de contribuição](docs/guia-contribuicao.md)
- [Escopo oficial do projeto](docs/escopo-projeto.md)
