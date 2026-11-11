# API Controle Financeiro

Projeto acadêmico de uma API REST para gerenciamento financeiro pessoal. Esta etapa contém o servidor Express, o schema do banco e a conexão com MySQL, sem rotas de negócio.

## Tecnologias

- Node.js com CommonJS (`require` / `module.exports`).
- Express para o servidor HTTP.
- MySQL com o driver mysql2 para conexão com o banco de dados.
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

Ajuste os valores locais. `PORT` define a porta HTTP, com fallback para `3000` quando ausente. `DB_HOST`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` configuram a conexão MySQL. Use `DB_NAME=api_financas` e informe um usuário e senha válidos do seu MySQL local. `JWT_SECRET` permanece reservado para a etapa de autenticação.

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

Não há rotas implementadas nesta etapa; uma requisição a `/` retorna HTTP 404, comportamento padrão do Express.

## Estrutura inicial

```text
api-controle-financeiro/
├── database/
│   ├── .gitkeep
│   ├── connection.js
│   └── schema.sql
├── middleware/
│   └── .gitkeep
├── models/
│   └── .gitkeep
├── routes/
│   └── .gitkeep
├── utils/
│   └── .gitkeep
├── testes/
│   └── .gitkeep
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── server.js
```

Os diretórios estão reservados para as próximas Issues. Os arquivos `.gitkeep` permitem versionar os diretórios vazios. As futuras regras de acesso a dados serão organizadas em `models/`.

## Fluxo de colaboração

As funcionalidades são desenvolvidas em branches `feature/*`, com Pull Request para `develop` e aprovação de outro integrante. A branch `main` contém a versão estável.

## Documentação da equipe

- [Instruções para agentes Codex](AGENTS.md)
- [Guia de contribuição](docs/guia-contribuicao.md)
- [Escopo oficial do projeto](docs/escopo-projeto.md)
