# API Controle Financeiro

Projeto acadêmico de uma API REST para gerenciamento financeiro pessoal. Estão implementados o servidor Express, o banco MySQL e o cadastro de usuários com validação, hash de senha e criação dos dados padrão.

## Tecnologias

- Node.js com CommonJS (`require` / `module.exports`).
- Express para o servidor HTTP.
- MySQL com o driver mysql2 para conexão com o banco de dados.
- bcrypt para proteger as senhas com hash.
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

Veja os exemplos executáveis em [testes/requisicoes.md](testes/requisicoes.md). Login e autenticação JWT pertencem às próximas Issues.

## Testes

```bash
npm test
```

Os testes usam o executor nativo do Node.js, validam os dígitos do CPF e o comportamento transacional do model com falhas simuladas. Não gravam dados no MySQL. No PowerShell, se a política local bloquear `npm.ps1`, use `npm.cmd test` e `npm.cmd run dev`.

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
│   ├── cpf.test.js
│   ├── usuario.test.js
│   └── requisicoes.md
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── server.js
```

Os arquivos `.gitkeep` preservam os diretórios iniciais. O SQL de cadastro fica em `models/Usuario.js`; `routes/auth.js` valida as entradas e monta as respostas. O middleware JWT será implementado em outra Issue.

## Fluxo de colaboração

As funcionalidades são desenvolvidas em branches `feature/*`, com Pull Request para `develop` e aprovação de outro integrante. A branch `main` contém a versão estável.

## Documentação da equipe

- [Instruções para agentes Codex](AGENTS.md)
- [Guia de contribuição](docs/guia-contribuicao.md)
- [Escopo oficial do projeto](docs/escopo-projeto.md)
