# API Controle Financeiro

Projeto acadêmico de uma API REST para gerenciamento financeiro pessoal. Esta etapa contém apenas a configuração inicial do backend e a inicialização do servidor Express, sem rotas de negócio ou conexão com banco de dados.

## Tecnologias

- Node.js com CommonJS (`require` / `module.exports`).
- Express para o servidor HTTP.
- dotenv para carregar variáveis de ambiente.
- nodemon para reiniciar o servidor durante o desenvolvimento.

MySQL está previsto para as próximas etapas; ainda não há integração implementada.

## Pré-requisitos

- Node.js 18 ou superior, compatível com Express 5 (preferencialmente uma versão LTS com suporte).
- npm.
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

Ajuste os valores locais. `PORT` define a porta HTTP, com fallback para `3000` quando ausente. As variáveis `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` e `JWT_SECRET` são apenas reservas para as próximas etapas e ainda não são utilizadas pelo servidor.

O arquivo de exemplo contém valores fictícios. Não versione o `.env` nem credenciais reais.

## Execução

Iniciar o servidor:

```bash
npm start
```

Iniciar em desenvolvimento, com reinicialização automática:

```bash
npm run dev
```

O terminal exibirá `Servidor iniciado na porta 3000` ou a porta configurada em `PORT`. Para encerrar, pressione `Ctrl+C`.

Não há rotas implementadas nesta etapa; uma requisição a `/` retorna HTTP 404, comportamento padrão do Express.

## Estrutura inicial

```text
api-controle-financeiro/
├── database/
│   └── .gitkeep
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
