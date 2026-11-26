require('dotenv').config();

const express = require('express');
const pool = require('./database/connection');
const protegerRota = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/auth', require('./routes/auth'));

// Os Routers financeiros deverão ser registrados depois desta proteção.
app.use(['/categorias', '/fontes-destinos', '/lancamentos', '/relatorios'], protegerRota);
app.use('/categorias', require('./routes/categorias'));
app.use('/fontes-destinos', require('./routes/fontes-destinos'));
app.use('/lancamentos', require('./routes/lancamentos'));
app.use('/relatorios', require('./routes/relatorios'));
app.use(
  '/saude-financeira',
  protegerRota,
  require('./routes/saude-financeira')
);

app.use((req, res) => {
  return res.status(404).json({ erro: 'Rota não encontrada.' });
});

app.use((error, req, res, next) => {
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({ erro: 'Token ausente, inválido ou expirado.' });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido.' });
  }
  console.error('Erro ao processar requisição:', error.code || error.name);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
});

// Importar a aplicação nos testes não deve iniciar o servidor nem acessar o banco.
if (require.main === module) {
  pool.getConnection((error, connection) => {
    if (error) {
      console.error('Não foi possível conectar ao MySQL:', error.code);
      pool.end();
      process.exitCode = 1;
      return;
    }

    connection.release();
    console.log('Conexão com MySQL estabelecida.');
    app.listen(port, () => {
      console.log(`Servidor iniciado na porta ${port}`);
    });
  });
}

module.exports = app;
