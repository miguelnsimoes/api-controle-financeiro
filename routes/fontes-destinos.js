const express = require('express');
const FonteDestino = require('../models/FonteDestino');

const router = express.Router();
const tipos = ['renda', 'conta', 'cartao_credito'];

function validarFonteDestino(corpo) {
  const { nome, tipo, dia_fechamento, dia_vencimento, limite } = corpo || {};
  const erros = {};
  const cartao = tipo === 'cartao_credito';

  if (typeof nome !== 'string' || !nome.trim()) {
    erros.nome = 'Informe o nome.';
  }
  if (!tipos.includes(tipo)) {
    erros.tipo = 'O tipo deve ser renda, conta ou cartao_credito.';
  }
  if ((cartao || dia_fechamento != null)
      && (!Number.isInteger(dia_fechamento) || dia_fechamento < 1 || dia_fechamento > 31)) {
    erros.dia_fechamento = 'Informe um dia inteiro entre 1 e 31.';
  }
  if ((cartao || dia_vencimento != null)
      && (!Number.isInteger(dia_vencimento) || dia_vencimento < 1 || dia_vencimento > 31)) {
    erros.dia_vencimento = 'Informe um dia inteiro entre 1 e 31.';
  }
  if (cartao && (!Number.isFinite(limite) || limite < 0.01)) {
    erros.limite = 'Informe um limite de pelo menos um centavo.';
  }
  if (Object.keys(erros).length > 0) {
    return { erros };
  }

  return {
    dados: {
      nome: nome.trim(),
      tipo,
      diaFechamento: cartao ? dia_fechamento : null,
      diaVencimento: cartao ? dia_vencimento : null,
      limite: cartao ? limite : null,
    },
  };
}

function tratarErroDeGravacao(error, res, next) {
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      erro: 'Fonte ou destino já cadastrado.',
      campos: { nome: 'Já existe uma fonte ou destino com este nome.' },
    });
  }
  return next(error);
}

router.get('/', async (req, res, next) => {
  const { tipo } = req.query;

  if (tipo !== undefined && !tipos.includes(tipo)) {
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

router.post('/', async (req, res, next) => {
  const { dados, erros } = validarFonteDestino(req.body);
  if (erros) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: erros });
  }

  try {
    const fonteDestino = await FonteDestino.criar({ ...dados, usuarioId: req.auth.id });
    return res.status(201).json(fonteDestino);
  } catch (error) {
    return tratarErroDeGravacao(error, res, next);
  }
});

router.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      campos: { id: 'Informe um identificador válido.' },
    });
  }

  const { dados, erros } = validarFonteDestino(req.body);
  if (erros) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: erros });
  }

  try {
    const fonteDestino = await FonteDestino.atualizar(id, { ...dados, usuarioId: req.auth.id });
    if (!fonteDestino) {
      return res.status(404).json({ erro: 'Fonte ou destino não encontrado.' });
    }
    return res.status(200).json(fonteDestino);
  } catch (error) {
    return tratarErroDeGravacao(error, res, next);
  }
});

module.exports = router;
