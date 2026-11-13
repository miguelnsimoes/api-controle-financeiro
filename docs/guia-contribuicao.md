# Guia de contribuição da equipe

Este guia orienta Miguel, Daniel e Yaron no desenvolvimento da API Controle Financeiro. A entrega informada pela equipe é **26/11/2026**. Consulte o [escopo oficial](escopo-projeto.md), as [instruções dos agentes](../AGENTS.md) e o [README](../README.md).

O escopo oficial é a principal fonte dos requisitos. Issues dividem as tarefas, Projects organiza o Kanban e Milestones agrupam entregas. Se uma Issue divergir do escopo oficial, converse com a equipe e a professora antes de implementar o ponto. O escopo oficial permite até três pessoas, embora alguns trechos mencionem dois integrantes; confirmem essa inconsistência com a professora. As datas oficiais ficam no ambiente virtual.

## 1. Escolher e assumir uma tarefa

1. Entre no [repositório](https://github.com/miguelnsimoes/api-controle-financeiro).
2. Abra a aba [Issues](https://github.com/miguelnsimoes/api-controle-financeiro/issues) para consultar as tarefas e o **Projects** associado ao repositório para identificar quais estão em **Todo**. Uma Issue aberta não está necessariamente disponível para começar.
3. Leia toda a descrição, os critérios de aceitação, as dependências, o nome sugerido da branch e a Milestone, quando indicada.
4. Abra **Projects** para visualizar o quadro associado ao repositório. Se não conseguir acessá-lo, peça o link ou as permissões a outro integrante.
5. Em **Assignees**, atribua a Issue a você. Confirme com a equipe antes de assumir algo já atribuído.
6. Atualize o campo de status do item no Kanban para **In Progress** quando começar.

| Coluna | Significado |
| --- | --- |
| Todo | Tarefa ainda não iniciada. |
| In Progress | Implementação em andamento. |
| In Review | PR aberto e aguardando revisão ou ajustes. |
| Done | Alteração integrada e validada em `develop`. |

Se essas colunas não estiverem configuradas, combinem os estados equivalentes. Não duplique uma tarefa que outro integrante já está fazendo.

### Como o agente de IA deve escolher a próxima Issue

O agente de Miguel, Daniel ou Yaron deve consultar as Issues e o Kanban do GitHub antes de iniciar uma tarefa. Não basta deduzir a próxima atividade pelo número da última Issue implementada.

Se você indicar uma Issue específica, o agente deve conferir essa Issue e respeitar sua escolha. Se pedir para ele escolher a próxima tarefa, o procedimento é:

1. Identificar seu nome e a conta GitHub que deve receber a atribuição.
2. Consultar as Issues abertas que estejam em **Todo** no Project.
3. Priorizar uma tarefa atribuída a você. Se não houver, selecionar uma sem responsável, com as dependências já concluídas, respeitando a prioridade e a Milestone do quadro. Em caso de empate, usar a de menor número.
4. Ler a descrição, os critérios de aceitação e a branch sugerida. Uma tarefa com dependência pendente ou atribuída a outro integrante não deve ser assumida automaticamente.
5. Informar a Issue escolhida e o motivo, atribuí-la à sua conta em **Assignees** e mover seu item para **In Progress** quando o trabalho começar.
6. Conferir novamente a atribuição e o status antes de implementar, para evitar que dois integrantes assumam a mesma tarefa ao mesmo tempo.

Se nenhuma tarefa estiver disponível, o agente deve informar o impedimento. Se faltar acesso ao Project, à Issue ou às ferramentas de atualização, deve orientar o integrante a consultar ou atualizar o GitHub manualmente e informar o que ficou pendente. Não deve inventar o estado de uma Issue nem dizer que atualizou algo sem conferir.

Por exemplo, ao receber “sou Daniel, vamos pegar a próxima tarefa”, o agente consulta o **Todo**, seleciona uma Issue disponível para Daniel, registra a atribuição e o início no Kanban e só depois prepara a branch indicada na Issue.

### Como o agente deve ajudar a manter o Kanban

O agente deve acompanhar o estado da Issue durante o desenvolvimento e ajudar a registrar as mudanças no GitHub Projects:

| Momento | Atualização no Kanban |
| --- | --- |
| Issue disponível, ainda não iniciada | Manter em **Todo**. |
| Integrante assumiu e iniciou a implementação | Registrar o responsável e mover para **In Progress**. |
| Implementação validada, mas ainda sem PR | Manter em **In Progress** e informar que falta abrir o PR. |
| PR aberto para `develop` | Vincular o PR à Issue e mover para **In Review**. |
| PR em revisão ou recebendo correções | Acompanhar os ajustes e manter **In Review** enquanto aguarda aprovação e integração. |
| Merge concluído e resultado validado em `develop` | Mover para **Done** e conferir o fechamento da Issue. |

As atualizações devem refletir fatos confirmados. Terminar um commit ou dar push não é suficiente para marcar **Done**. Em cada entrega parcial, o agente deve informar a Issue, seu responsável, o status atual e o próximo passo.

Se tiver acesso autenticado às ferramentas do GitHub, o agente deve efetuar as atribuições e mudanças de status conforme esse fluxo. Sem acesso, deve indicar os passos manuais e deixar explícito o que não conseguiu atualizar. Isso não autoriza abrir PR, fazer commit, push ou merge: essas operações continuam exigindo sua autorização explícita.

Aqui, “manter o Kanban” significa registrar o andamento no GitHub Projects. O histórico de código continua nos commits do Git; atualizar o quadro não cria um commit no repositório.

## 2. Preparar o ambiente e a branch

Instale Git, Node.js compatível com o projeto e npm. Siga o README para requisitos de execução. No terminal:

```powershell
git clone https://github.com/miguelnsimoes/api-controle-financeiro.git
cd api-controle-financeiro
code .
```

`clone` baixa o repositório, `cd` entra na pasta e `code .` abre essa pasta no VS Code. Se `code` não estiver disponível, use **Arquivo > Abrir Pasta**. Quem já clonou deve apenas abrir a pasta existente.

Antes de alterar arquivos, confira:

```powershell
git status
git branch --show-current
git branch -a
```

`status` mostra alterações locais; `--show-current` informa a branch ativa; `branch -a` lista branches locais e referências remotas conhecidas. Se houver alterações, trate-as conforme a seção de problemas antes de trocar de branch.

Com a árvore limpa, prepare a base:

```powershell
git fetch origin
git switch develop
git pull --ff-only origin develop
```

`fetch` atualiza as referências do GitHub sem mudar os arquivos de trabalho. `switch` seleciona a branch. `git pull origin develop` busca e integra a versão remota; aqui usamos `--ff-only` para permitir somente avanço direto, evitando um commit de merge inesperado. Execute o pull de `develop` estando em `develop`. Se o avanço direto falhar, pare e peça ajuda.

Se `develop` ainda não existir localmente, mas `origin/develop` aparecer após o fetch:

```powershell
git switch --track origin/develop
git pull --ff-only origin develop
```

Confira se a branch da Issue já existe em `git branch -a`. Para uma branch nova, use **exatamente o nome indicado na Issue**. Exemplo da Issue #1, somente se ainda não existir:

```powershell
git switch -c feature/1-setup-inicial
git branch --show-current
```

`switch -c` cria a branch a partir do commit atual de `develop` e passa a trabalhar nela. Se a branch já existe localmente, use `git switch feature/1-setup-inicial` após conferir seu estado. Se existir apenas no remoto, use `git switch --track origin/feature/1-setup-inicial`. Não recrie uma branch existente nem reaproveite a branch de outra Issue.

Não implemente alterações em `main` ou `develop`. Ambas são protegidas. `main` é a versão estável e de entrega; `develop` recebe funcionalidades por PR.

Na branch correta, instale as dependências e prepare o ambiente conforme o README:

```powershell
npm ci
Copy-Item .env.example .env
```

`npm ci` instala as versões do lockfile e recria `node_modules`; não o execute durante um servidor em uso. Copie o exemplo somente se ainda não tiver `.env`, para preservar sua configuração local. Ajuste os valores sem versionar credenciais. As futuras Issues de banco terão instruções adicionais; esta preparação não implementa integração MySQL.

## 3. Trabalhar e validar a Issue

Implemente somente os critérios da tarefa. Use CommonJS, as bibliotecas permitidas e a arquitetura do escopo oficial: SQL de execução nas classes de `models/`, rotas com `express.Router()` e JWT em `middleware/`. Os scripts de criação e seed ficam em `database/`. Bibliotecas além de Express, mysql2, jsonwebtoken, express-jwt, bcrypt, dotenv e nodemon exigem aprovação prévia da professora.

Informe ao agente seu nome e a Issue desejada, ou peça para ele selecionar uma disponível em **Todo** conforme o fluxo acima. Ele deve consultar a descrição da Issue e o Kanban, ler `AGENTS.md`, consultar o escopo oficial, preservar alterações locais e explicar a solução. Todos precisam conseguir explicar o código na apresentação.

Faça testes adequados à alteração. Para a configuração inicial:

```powershell
node --check server.js
npm ls --depth=0
npm run dev
```

O primeiro comando verifica a sintaxe de `server.js`; o segundo lista as dependências diretas; o terceiro inicia o servidor com nodemon. Em outro terminal, na porta configurada:

```powershell
curl.exe -i http://localhost:3000
```

Na etapa inicial, sem rotas, `404` com `Cannot GET /` confirma uma resposta do servidor. Falha de conexão indica que ele não está acessível. Nas próximas Issues, teste os endpoints e critérios implementados, inclusive entradas inválidas e acesso de outro usuário, quando aplicável. Use `Ctrl+C` no terminal do servidor para encerrá-lo. Não confunda a resposta inicial com o padrão JSON exigido na API final.

Antes de preparar o commit:

```powershell
git status
git diff
git diff --check
git check-ignore .env node_modules/
```

Revise o conteúdo alterado e eventuais problemas de espaços em branco. O último comando deve indicar os caminhos ignorados. `.env.example` deve ser versionável e conter apenas valores fictícios. Nunca inclua `.env`, tokens ou senhas reais. Se um segredo já tiver sido rastreado, o `.gitignore` sozinho não resolve; peça ajuda e substitua a credencial comprometida.

## 4. Preparar o commit e publicar a branch

Os comandos desta seção são para execução consciente pelo desenvolvedor após revisão. O Codex não deve executar commit, push, merge ou operações destrutivas sem autorização explícita, nem abrir PR automaticamente sem autorização.

Adicione somente os arquivos da Issue. Exemplo para uma mudança em `server.js` e `README.md`:

```powershell
git add server.js README.md
git diff --cached
git status
git commit -m "chore: configura servidor Express inicial"
git push -u origin feature/1-setup-inicial
```

Adapte os arquivos, a mensagem e a branch à sua tarefa. `git add` prepara arquivos para o próximo commit; `diff --cached` mostra exatamente o conteúdo preparado; `commit` registra uma versão local; `push` publica os commits no GitHub. `-u` associa a branch local à remota para os próximos envios. Evite adicionar tudo sem revisar, pois pode incluir trabalho alheio.

Prefira commits pequenos e descritivos, por exemplo `feat: adiciona validação de CPF` ou `docs: explica configuração local`, em vez de “ajustes”. Não inclua funcionalidades fora da Issue só para aproveitar o commit.

## 5. Abrir e revisar o Pull Request

1. No GitHub, abra **Pull requests > New pull request**.
2. Escolha **base: develop** e **compare: sua feature branch**. Confira a direção e os arquivos exibidos.
3. Escreva um título claro, o que mudou, como testou e limitações conhecidas. Vincule a Issue com `Refs #1`, por exemplo, substituindo o número.
4. Se usar `Closes #1`, confira o fechamento: palavras-chave de fechamento automático dependem da integração à branch padrão. Um PR para `develop` pode não fechar a Issue automaticamente.
5. Em **Reviewers**, selecione outro integrante. Miguel pode pedir revisão a Daniel ou Yaron, por exemplo. O autor não pode aprovar o próprio PR para cumprir a regra.
6. Mova o item do Kanban para **In Review** e aguarde a revisão.
7. Se houver pedidos de ajuste, faça as correções na mesma feature branch, valide e crie novos commits. Um novo `git push` atualiza o mesmo PR; não precisa abrir outro.
8. Aguarde a aprovação de outro integrante e todos os requisitos de proteção. Alterações posteriores podem exigir nova aprovação.
9. Depois da aprovação e das verificações exigidas, o integrante autorizado realiza o merge pelo método permitido nas configurações do repositório. Não contorne bloqueios ou desative proteções.
10. Confirme a integração e valide em `develop`. Depois, atualize o Kanban para **Done** e confira o fechamento da Issue; feche-a manualmente se necessário, de acordo com a equipe.

Uma aprovação não substitui verificações pendentes. O envio de `develop` para `main` também deve ocorrer por PR, conforme o planejamento da equipe.

## 6. Resolver problemas comuns

### Branch desatualizada

Com árvore limpa, execute `git fetch origin` e confira sua branch. Se precisa apenas baixar commits da mesma feature branch, use `git pull --ff-only origin NOME_DA_BRANCH`, substituindo o nome. Se houver divergência, peça ajuda antes de integrar.

Para trazer mudanças de `develop` para uma feature já em andamento, combine a atualização com a equipe. Após revisar o estado e autorizar a integração local, o desenvolvedor pode usar:

```powershell
git switch feature/1-setup-inicial
git fetch origin
git merge origin/develop
```

Esse merge é local, dentro da feature, para sincronização. Ele não substitui o PR necessário para integrar a feature em `develop`. O Codex precisa de autorização explícita para executá-lo. Rode novamente os testes antes de publicar.

### Conflitos de merge

Use `git status` para identificar arquivos em conflito. Abra-os no VS Code e examine os dois lados: não aceite automaticamente “Current” ou “Incoming”. Converse com o autor do trecho se não entender a intenção. Remova os marcadores de conflito mantendo a solução combinada, teste e revise o diff. Prepare os arquivos resolvidos com `git add` e conclua o merge com `git commit` somente após revisar e autorizar. Se estiver inseguro, pare e peça ajuda; não descarte arquivos para fazer o aviso desaparecer.

### Push rejeitado

Leia a mensagem. Pode ser falta de permissão, branch protegida ou commits remotos ausentes localmente. Confirme a branch, execute `git fetch origin` e compare com a equipe. Em uma feature sem divergência, um pull com `--ff-only` pode resolver. Se os históricos divergirem, peça ajuda; não use force push como solução padrão. Nunca envie trabalho diretamente para `main` ou `develop`.

### Pull Request bloqueado

Confira se a base é `develop`, se falta aprovação de outro integrante, se há conflitos ou verificações falhando. Atenda o motivo indicado. Peça ajuda ao responsável pelo repositório se as permissões estiverem incorretas, sem desativar proteções para passar o PR.

### Alterações locais ainda não commitadas

Execute `git status` e `git diff` antes de trocar de branch. Se pertencem à Issue atual, conclua a revisão e faça o commit na feature adequada quando estiver pronto. Se são de outra tarefa ou foram feitas na branch errada, peça ajuda para preservá-las e transferi-las com segurança. Não use limpeza ou restauração destrutiva para “liberar” a troca de branch.

### Alteração iniciada em branch protegida

Pare de editar e não faça commit nem push nessa branch. Informe o estado do Git à equipe ou ao Codex para preservar as mudanças e colocá-las em uma feature baseada em `develop`. A estratégia depende de haver commits e alterações locais; não tente corrigir com comandos destrutivos.

### Quando pedir ajuda

Peça ajuda quando houver dúvida sobre o escopo oficial, dependência de outra Issue, conflito em código alheio, divergência de histórico, credencial exposta ou bloqueio de permissões. Compartilhe a mensagem de erro, sua branch e o `git status`, sem copiar segredos do `.env`.
