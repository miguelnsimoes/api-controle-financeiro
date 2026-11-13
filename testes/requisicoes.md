# Requisições da API

Inicie o MySQL e o servidor com `npm.cmd run dev` no PowerShell (ou `npm run dev` em outros terminais). Use a porta definida no `.env`; os exemplos consideram `3000`.

Estes comandos criam dados no banco configurado. Execute-os em seu ambiente de desenvolvimento com dados fictícios. Não execute novamente o schema para testar uma rota.

## Cadastro válido — 201

No PowerShell:

```powershell
$cadastro = @{
  nome = 'Usuario de exemplo'
  email = 'usuario@example.com'
  cpf = '529.982.247-25'
  senha = 'Exemplo123'
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/auth/cadastro' -ContentType 'application/json; charset=utf-8' -Body $cadastro
```

Ou no Bash, com curl:

```bash
curl -i -X POST http://localhost:3000/auth/cadastro \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Usuario de exemplo","email":"usuario@example.com","cpf":"529.982.247-25","senha":"Exemplo123"}'
```

Esperado: `201 Created` e somente `id`, `nome` e `email`. O identificador varia. O banco deve conter o CPF `52998224725`, a senha como hash bcrypt, nove categorias e uma “Conta corrente” para o novo usuário.

## E-mail duplicado após normalização — 409

Após o cadastro anterior, no Bash:

```bash
curl -i -X POST http://localhost:3000/auth/cadastro \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Outro exemplo","email":" USUARIO@EXAMPLE.COM ","cpf":"111.444.777-35","senha":"Exemplo123"}'
```

Esperado: `409`, com `campos.email`. No PowerShell, adapte o objeto do primeiro exemplo para os mesmos valores e repita `Invoke-RestMethod`; respostas 400/409 aparecem como erro HTTP no terminal.

## CPF duplicado após normalização — 409

```bash
curl -i -X POST http://localhost:3000/auth/cadastro \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Outro exemplo","email":"outro@example.com","cpf":"52998224725","senha":"Exemplo123"}'
```

Esperado: `409`, com `campos.cpf`.

## Campos inválidos — 400

```bash
curl -i -X POST http://localhost:3000/auth/cadastro \
  -H 'Content-Type: application/json' \
  -d '{"nome":" ","email":"invalido","cpf":"52998224724","senha":"123"}'
```

Esperado: `400`, com `erro: "Dados inválidos."` e erros para os quatro campos. Também teste `{}`, CPF com todos os dígitos iguais, senha só com letras ou só com números e campos com tipos incorretos. Nenhum desses casos deve criar usuário ou dados padrão.

## JSON malformado — 400

```bash
curl -i -X POST http://localhost:3000/auth/cadastro \
  -H 'Content-Type: application/json' \
  -d '{'
```

Esperado: `400`, com `erro: "JSON inválido."`.

## Atomicidade e concorrência

`npm test` cobre falhas simuladas nas inserções de usuário, categorias e fonte/destino, exigindo rollback e liberação da conexão. A implementação também foi validada no MySQL com falhas controladas após inserções parciais e com cadastros HTTP concorrentes. Os registros exclusivos dessa validação foram removidos ao final.

Não altere tabelas, restrições ou dados de colegas para simular falhas. Para repetir a validação real com falhas induzidas, use um ambiente de teste separado. Não há rota para consultar ou excluir usuários nesta Issue.

## Login — Issue #5, segunda etapa

Após cadastrar o usuário do exemplo, configure `JWT_SECRET` no `.env` e reinicie o servidor se necessário.

No Bash:

```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":" USUARIO@EXAMPLE.COM ","senha":"Exemplo123"}'
```

No PowerShell:

```powershell
$login = @{ email = ' USUARIO@EXAMPLE.COM '; senha = 'Exemplo123' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/auth/login' -ContentType 'application/json' -Body $login
```

Esperado: `200`, com `token` JWT válido por uma hora e `usuario` contendo apenas `id`, `nome` e `email`.

Repita com senha incorreta ou e-mail inexistente: ambos devem retornar `401` com `erro: "E-mail ou senha inválidos."`, sem token nem indicação de qual credencial falhou. Envie `{}` para conferir o retorno `400` por campos obrigatórios ausentes.

## Perfil protegido — Issue #5, terceira etapa

No PowerShell, use o resultado do login para consultar seu perfil:

```powershell
$sessao = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/auth/login' -ContentType 'application/json' -Body $login
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/auth/me' -Headers @{ Authorization = "Bearer $($sessao.token)" }
```

No Bash, substitua o marcador pelo token retornado no login:

```bash
curl -i http://localhost:3000/auth/me \
  -H 'Authorization: Bearer TOKEN_RECEBIDO_NO_LOGIN'
```

Esperado: `200` com somente `id`, `nome` e `email` do usuário autenticado, consultados no banco. A resposta não contém CPF, senha ou `senha_hash`.

Sem token:

```bash
curl -i http://localhost:3000/auth/me
```

Com token inválido:

```bash
curl -i http://localhost:3000/auth/me \
  -H 'Authorization: Bearer token-invalido'
```

Ambos devem retornar `401` em JSON com `erro: "Token ausente, inválido ou expirado."`. Um token expirado deve produzir a mesma resposta. `npm test` cobre esses cenários e a rejeição de assinaturas e algoritmos incorretos, sem precisar aguardar uma hora.

Também consulte `/auth/me?id=999` com um token válido: o perfil continua sendo o dono do token. Caso o usuário do token não exista mais no banco, o retorno é `404`.
