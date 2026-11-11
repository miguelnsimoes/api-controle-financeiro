# Requisições da Issue #4

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
