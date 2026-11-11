const express = require('express');
const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const { cpfValido } = require('../utils/cpf');

const router = express.Router();

router.post('/cadastro', async (req, res, next) => {
  const { nome, email, cpf, senha } = req.body || {};
  const erros = {};
  const nomeNormalizado = typeof nome === 'string' ? nome.trim() : '';
  const emailNormalizado = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!nomeNormalizado || [...nomeNormalizado].length > 120) {
    erros.nome = 'Informe um nome com até 120 caracteres.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)
      || [...emailNormalizado].length > 160) {
    erros.email = 'Informe um e-mail válido com até 160 caracteres.';
  }
  if (typeof cpf !== 'string' || !cpfValido(cpf)) {
    erros.cpf = 'Informe um CPF válido.';
  }
  if (typeof senha !== 'string' || senha.length < 8
      || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    erros.senha = 'A senha deve ter ao menos 8 caracteres, com letras e números.';
  } else if (Buffer.byteLength(senha, 'utf8') > 72) {
    erros.senha = 'A senha deve ocupar no máximo 72 bytes em UTF-8, limite do bcrypt.';
  }

  if (Object.keys(erros).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: erros });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await Usuario.cadastrar({
      nome: nomeNormalizado,
      email: emailNormalizado,
      cpf: cpf.replace(/\D/g, ''),
      senhaHash,
    });

    return res.status(201).json(usuario);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const mensagem = error.sqlMessage || '';
      const campo = mensagem.includes('uq_usuarios_cpf') ? 'cpf'
        : mensagem.includes('uq_usuarios_email') ? 'email' : null;

      if (campo) {
        return res.status(409).json({
          erro: 'Usuário já cadastrado.',
          campos: { [campo]: `Já existe um usuário com este ${campo === 'cpf' ? 'CPF' : 'e-mail'}.` },
        });
      }
    }
    return next(error);
  }
});

module.exports = router;
