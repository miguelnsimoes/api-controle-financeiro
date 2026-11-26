
const express = require('express');
const SaudeFinanceira = require('../models/SaudeFinanceira');

const {
  analisarSaudeFinanceira,
  inicioHistorico,
} = require('../utils/saude-financeira');

const router = express.Router();

// Issue #17 - Saúde financeira
router.get('/', async (req, res, next) => {
  try {
    const agora = new Date();

    const linhas = await SaudeFinanceira.buscarLancamentos(
      req.auth.id,
      inicioHistorico(agora)
    );

    const resultado = analisarSaudeFinanceira(linhas, agora);

    return res.status(200).json(resultado);
  } catch (erro) {
    return next(erro);
  }
});

module.exports = router;
