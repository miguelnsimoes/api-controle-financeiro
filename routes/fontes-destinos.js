const express = require('express');
const FonteDestino = require('../models/FonteDestino');

const router = express.Router();

router.get('/', async (req, res, next) => {
  const { tipo } = req.query;

  if (tipo !== undefined && !['renda', 'conta', 'cartao_credito'].includes(tipo)) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      campos: { tipo: 'O tipo deve ser renda, conta ou cartao_credito.' },
    });
  }

  try {
    const fontesDestinos = await FonteDestino.listar(req.auth.id, tipo);
    return res.status(200).json(fontesDestinos);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
