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

router.post('/', async (req, res, next) => {
  const { nome, tipo } = req.body || {};
  const erros = {};

  if (typeof nome !== 'string' || !nome.trim()) {
    erros.nome = 'Informe o nome.';
  }
  if (!['entrada', 'saida'].includes(tipo)) {
    erros.tipo = 'O tipo deve ser entrada ou saida.';
  }
  if (Object.keys(erros).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: erros });
  }

  try {
    const categoria = await Categoria.criar({
      nome: nome.trim(),
      tipo,
      usuarioId: req.auth.id,
    });
    return res.status(201).json(categoria);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        erro: 'Categoria já cadastrada.',
        campos: { nome: 'Já existe uma categoria com este nome e tipo.' },
      });
    }
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  const { nome, tipo } = req.body || {};
  const erros = {};

  if (!Number.isSafeInteger(id) || id <= 0) {
    erros.id = 'Informe um identificador válido.';
  }
  if (typeof nome !== 'string' || !nome.trim()) {
    erros.nome = 'Informe o nome.';
  }
  if (!['entrada', 'saida'].includes(tipo)) {
    erros.tipo = 'O tipo deve ser entrada ou saida.';
  }
  if (Object.keys(erros).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: erros });
  }

  try {
    const categoria = await Categoria.atualizar(id, {
      nome: nome.trim(),
      tipo,
      usuarioId: req.auth.id,
    });
    if (!categoria) {
      return res.status(404).json({ erro: 'Categoria não encontrada.' });
    }
    return res.status(200).json(categoria);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        erro: 'Categoria já cadastrada.',
        campos: { nome: 'Já existe uma categoria com este nome e tipo.' },
      });
    }
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      campos: { id: 'Informe um identificador válido.' },
    });
  }

  try {
    const excluida = await Categoria.excluir(id, req.auth.id);
    if (!excluida) {
      return res.status(404).json({ erro: 'Categoria não encontrada.' });
    }
    return res.status(204).end();
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        erro: 'Não é possível excluir uma categoria com lançamentos vinculados.',
      });
    }
    return next(error);
  }
});

module.exports = router;
