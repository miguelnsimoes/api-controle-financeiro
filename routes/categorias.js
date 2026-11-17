const express = require('express');
const Categoria = require('../models/Categoria');

const router = express.Router();

router.get('/', async (req, res, next) => {
  const { tipo } = req.query;

  if (tipo !== undefined && !['entrada', 'saida'].includes(tipo)) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      campos: { tipo: 'O tipo deve ser entrada ou saida.' },
    });
  }

  try {
    const categorias = await Categoria.listar(req.auth.id, tipo);
    return res.status(200).json(categorias);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
