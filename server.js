require('dotenv').config();

const express = require('express');
const pool = require('./database/connection');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/auth', require('./routes/auth'));

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
