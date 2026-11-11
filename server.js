require('dotenv').config();

const express = require('express');
const connection = require('./database/connection');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

connection.connect((error) => {
  if (error) {
    console.error('Não foi possível conectar ao MySQL:', error.code);
    connection.destroy();
    process.exitCode = 1;
    return;
  }

  console.log('Conexão com MySQL estabelecida.');
  app.listen(port, () => {
    console.log(`Servidor iniciado na porta ${port}`);
  });
});
