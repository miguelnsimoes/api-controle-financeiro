
# Roteiro de Apresentação — API de Controle Financeiro

## 1. Objetivo

Apresentar a arquitetura, as funcionalidades e os resultados
do desenvolvimento da API de Controle Financeiro.

Duração máxima: 10 minutos.

## 2. Divisão da apresentação

| Integrante | Responsabilidade | Tempo |
|---|---|---|
| Miguel Simões | Introdução, arquitetura e autenticação | 3 minutos |
| Daniel Kawata Hara | Lançamentos, parcelamento e faturas | 3 minutos |
| Yaron Buchler | Relatórios, testes e conclusão | 3 minutos |
| Equipe | Margem para transições e imprevistos | 1 minuto |

## 3. Miguel Simões — Introdução e autenticação

### Tempo: 0:00 a 3:00

### Introdução

- Apresentar o objetivo da API.
- Explicar o problema de organização financeira.
- Apresentar as principais tecnologias:
  Node.js, Express, MySQL, JWT e bcrypt.

### Arquitetura

Apresentar a estrutura do projeto:

- database: conexão e estrutura do banco de dados.
- middleware: autenticação.
- models: acesso e manipulação dos dados.
- routes: endpoints da API.
- utils: funções auxiliares.
- testes: validação das funcionalidades.

Apresentar as quatro tabelas principais:

- usuarios
- categorias
- fontes_destinos
- lancamentos

### Demonstração

- Cadastro de usuário.
- Tentativa de cadastro duplicado.
- Login e geração de token JWT.
- Explicação do isolamento dos dados por usuário.
- Listagem de categorias e fontes e destinos.

## 4. Daniel Kawata Hara — Lançamentos e parcelamento

### Tempo: 3:00 a 6:00

### Funcionalidades

- Cadastro de receitas e despesas.
- Consulta, atualização e exclusão de lançamentos.
- Filtros por período, categoria e fonte ou destino.
- Paginação dos resultados.
- Parcelamento de compras no cartão de crédito.

### Demonstração

Apresentar uma compra de R$ 100,00 parcelada em três vezes.

- Primeira parcela: R$ 33,34.
- Segunda parcela: R$ 33,33.
- Terceira parcela: R$ 33,33.

Explicar o tratamento do arredondamento e a preservação
do valor original da compra.

### Previsão de faturas

Apresentar o endpoint:

GET /relatorios/faturas?meses=3

Demonstrar:

- Distribuição das parcelas nas próximas faturas.
- Datas de fechamento e vencimento.
- Limite total, utilizado e disponível do cartão.

## 5. Yaron Buchler — Relatórios e conclusão

### Tempo: 6:00 a 9:00

### Relatório por categoria

Apresentar o endpoint:

GET /relatorios/categorias

Explicar:

- Agrupamento de receitas e despesas por categoria.
- Cálculo dos totais financeiros.
- Participação percentual de cada categoria.
- Comparação com o período anterior.
- Tratamento da variação quando o valor anterior é zero.

Demonstrar os dados do usuário fictício:

- Entradas: R$ 3.200,00.
- Saídas: R$ 350,00.

### Relatório por fontes e destinos

Apresentar o endpoint:

GET /relatorios/fontes-destinos

Explicar:

- Agrupamento dos valores por fonte ou destino.
- Separação entre entradas e saídas.
- Cálculo do saldo das contas.
- Identificação dos gastos no cartão de crédito.

Demonstrar:

- Entradas na conta: R$ 3.200,00.
- Saídas da conta: R$ 250,00.
- Saídas do cartão: R$ 100,00.
- Saldo da conta: R$ 2.950,00.

### Testes e qualidade

Apresentar os resultados da suíte de testes:

- 97 testes executados.
- 97 testes aprovados.
- Nenhuma falha.
- Nenhum teste ignorado.
- Integração validada com MySQL real.

### Conclusão

Destacar:

- Atendimento aos nove requisitos funcionais.
- Segurança e isolamento dos dados.
- Organização da arquitetura.
- Documentação para instalação e utilização.
- Contribuição dos integrantes no desenvolvimento.

## 6. Preparação para a apresentação

Antes da apresentação:

- [ ] Verificar a disponibilidade do MySQL.
- [ ] Conferir as configurações do arquivo .env.
- [ ] Confirmar a existência do banco api_financas.
- [ ] Confirmar a disponibilidade dos dados de demonstração.
- [ ] Iniciar a API com npm run dev.
- [ ] Preparar as requisições HTTP.
- [ ] Verificar os tokens de autenticação.
- [ ] Ensaiar a apresentação dentro do tempo disponível.

## 7. Material de apoio

- README.md
- database/schema.sql
- database/seed.sql
- testes/requisicoes.md
- docs/revisao-final.md

As requisições disponíveis em testes/requisicoes.md
podem ser utilizadas como referência para a demonstração.

Os períodos dos relatórios devem ser ajustados conforme
a data de carregamento dos dados de demonstração.

A divisão dos tópicos e dos tempos deverá ser confirmada
pelos integrantes antes da apresentação.
