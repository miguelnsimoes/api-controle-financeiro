# Instruções para agentes Codex

## Contexto e fontes

- Projeto acadêmico: API REST de Controle Financeiro, backend sem interface gráfica.
- Equipe: Miguel, Daniel e Yaron. Entrega informada pela equipe: **26/11/2026**.
- Consulte o [escopo oficial em Markdown](docs/escopo-projeto.md) antes de implementar qualquer funcionalidade. Ele é a principal fonte de requisitos; as Issues dividem o trabalho e delimitam o escopo de cada entrega.
- Consulte também a descrição e os critérios de aceitação da Issue atribuída e o [guia de contribuição](docs/guia-contribuicao.md).
- Não implemente funcionalidades de outras Issues nem antecipe requisitos futuros. O desafio de saúde financeira é opcional e depende de uma tarefa explicitamente atribuída.
- Se faltar acesso ao escopo oficial ou à Issue, informe a limitação e obtenha o contexto necessário antes de implementar requisitos dependentes deles. Não invente requisitos.
- Em caso de divergência entre Issue e escopo oficial, explique a diferença e peça esclarecimento antes de implementar o ponto divergente.
- O escopo oficial permite grupos de até três pessoas, mas menciona “dois integrantes” em alguns trechos. Mantenha os três integrantes informados acima e sinalize a inconsistência para confirmação com a professora. A data de entrega foi fornecida pela equipe; o escopo oficial remete as datas oficiais ao ambiente virtual.

## Tecnologias e arquitetura

- Use Node.js, npm, Express e CommonJS (`require` / `module.exports`).
- Bibliotecas permitidas: `express`, `mysql2`, `jsonwebtoken`, `express-jwt`, `bcrypt`, `dotenv` e `nodemon`. Não instale bibliotecas adicionais sem aprovação prévia da professora. Módulos nativos do Node.js podem ser usados.
- Instale uma dependência permitida apenas quando necessária à Issue. Não instale agora bibliotecas de etapas futuras.
- MySQL deve ser acessado por `mysql2`. Organize consultas SQL de execução exclusivamente nas classes de `models/`, com parâmetros (`?`), sem interpolar valores recebidos do cliente.
- Os scripts oficiais de criação e demonstração do banco ficam em `database/schema.sql` e `database/seed.sql`, conforme o escopo oficial; essa exigência não autoriza SQL nas rotas.
- `database/connection.js` configura a conexão lendo as variáveis de ambiente. Callbacks e a interface de promises do mysql2 são permitidos. Com pool, faça cada transação em uma única conexão obtida com `getConnection`.
- Organize rotas em `routes/` com `express.Router()`. Elas validam entradas, chamam os models e montam respostas. Middleware JWT fica em `middleware/`; funções puras ficam em `utils/`.
- Use `jsonwebtoken` para emissão de JWT, `express-jwt` para proteção e `bcrypt` para hash e comparação de senhas. Nunca retorne `senha_hash`.
- Carregue configuração com `dotenv`. Nunca versione `.env`, senhas reais ou chaves JWT. Mantenha `.env.example` com valores fictícios e `.gitignore` protegendo `.env`, variantes locais e `node_modules/`.
- Preserve os scripts `start: node server.js` e `dev: nodemon server.js`, com nodemon em `devDependencies`; mantenha o lockfile consistente.

## Requisitos transversais do escopo

Aplique estes requisitos quando trabalhar nas Issues correspondentes, sem antecipar implementação:

- Apenas cadastro e login são públicos; as demais rotas funcionais exigem JWT. O identificador do usuário vem de `req.auth.id`, nunca de dados fornecidos pelo cliente.
- Restrinja consultas ao proprietário e valide a posse de categoria e fonte/destino. Recursos de outro usuário devem retornar 404.
- Valide os dados no servidor. Preserve as restrições FK, UNIQUE e CHECK do modelo oficial; normalize e-mail e CPF e use transações nas gravações que precisam ser atômicas.
- Siga o formato de erro e os códigos HTTP da seção 11.6. Erros internos são registrados no servidor, sem expor detalhes ao cliente.
- Consulte as regras exatas de centavos, parcelamento, datas, fechamento e agregações nas seções correspondentes do escopo oficial. Não substitua requisitos por suposições.
- A entrega final prevê schema, seed, documentação e testes HTTP de todas as rotas em `testes/`. Esses artefatos devem ser implementados nas respectivas Issues.
- IA é apoio: todos os integrantes precisam explicar o código entregue. Não copie artefatos de outros projetos.

## Git e revisão

- `main` é protegida e contém a versão estável; `develop` é protegida e integra funcionalidades. Nunca desenvolva diretamente nessas branches.
- Cada funcionalidade tem sua própria branch, normalmente `feature/*`, criada a partir de `develop`. Use o nome definido na descrição da Issue e confira se já existe localmente ou no remoto antes de criar.
- Toda integração ocorre por Pull Request com aprovação de outro integrante. O autor não pode aprovar o próprio PR para satisfazer a regra.
- Nunca execute `commit`, `push`, `merge`, `reset --hard`, force push ou operações destrutivas sem autorização explícita do desenvolvedor. Uma solicitação de implementação não autoriza essas operações.
- Não abra PR automaticamente sem autorização explícita. Explicar comandos para execução manual não equivale a executá-los.
- Preserve alterações locais e arquivos existentes; não descarte, sobrescreva ou inclua no trabalho alterações de terceiros sem necessidade.

## Procedimento de trabalho

1. Antes de implementar, identifique o integrante e a Issue; use o contexto da conversa e pergunte somente o que estiver faltando. Para tarefas de documentação sem Issue informada, registre essa ausência e não invente um número.
2. Leia o escopo oficial e a Issue e delimite os arquivos e critérios envolvidos. Inspecione a estrutura, `package.json`, dependências e instruções locais.
3. Confira `git status`, `git branch --show-current` e as branches disponíveis. Examine a base da branch; não afirme origem histórica sem evidência.
4. Explique como atualizar `develop` antes de criar a branch: com árvore limpa, `git switch develop` e `git pull --ff-only origin develop`. Depois, `git switch -c NOME_DA_ISSUE`. Se a branch já existe, inspecione-a antes de reutilizar. Não troque branches carregando alterações sem avaliar o impacto.
5. Explique os comandos Git utilizados. Operações sujeitas à autorização acima continuam dependendo dela.
6. Implemente somente a Issue e evite modificar código de outros integrantes sem necessidade. Explique o código e suas decisões para que o desenvolvedor consiga apresentá-lo.
7. Valide de acordo com a mudança: sintaxe, dependências, inicialização e testes HTTP relevantes; teste isolamento e falhas quando aplicáveis. Não invente scripts de teste existentes nem afirme ter executado verificações que não executou.
8. Confira o diff, `git diff --check`, `git status` e se arquivos sensíveis estão ignorados. Somente depois oriente a revisão e o PR para `develop`.
9. Ao concluir, informe arquivos alterados, comportamento, verificações e limitações. Deixe commit, publicação e integração para revisão do desenvolvedor, salvo autorização explícita.
