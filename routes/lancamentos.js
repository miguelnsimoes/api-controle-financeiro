const express = require('express');
const Lancamento = require('../models/Lancamento');
const { idValido, validarLancamento } = require('../utils/validarLancamento');

const router = express.Router();
const mensagemIdInvalido = 'Informe um identificador válido.';

function dadosInvalidos(res, campos) {
  return res.status(400).json({ erro: 'Dados inválidos.', campos });
}

router.param('id', (req, res, next, parametro) => {
  const id = Number(parametro);
  if (!/^\d+$/.test(parametro) || !idValido(id)) {
    return dadosInvalidos(res, { id: mensagemIdInvalido });
  }
  req.lancamentoId = id;
  return next();
});

router.get('/', async (req, res) => {
  return res.json(await Lancamento.listar(req.auth.id));
});

router.get('/:id', async (req, res) => {
  const lancamento = await Lancamento.buscarPorId(req.lancamentoId, req.auth.id);
  if (!lancamento) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
  return res.json(lancamento);
});

async function salvar(req, res) {
  const criacao = req.method === 'POST';
  const { dados, campos } = validarLancamento(req.body, criacao);
  if (campos) return dadosInvalidos(res, campos);

  const resultado = await Lancamento.salvar(req.auth.id, dados, req.lancamentoId);
  if (resultado.ausente) return res.status(404).json({ erro: resultado.ausente });
  if (resultado.campos) return dadosInvalidos(res, resultado.campos);
  return res.status(criacao ? 201 : 200).json(resultado.lancamentos ?? resultado.lancamento);
}

router.post('/', salvar);
router.put('/:id', salvar);

router.delete('/:id', async (req, res) => {
  const { todasParcelas } = req.query;
  if (todasParcelas !== undefined && !['true', 'false'].includes(todasParcelas)) {
    return dadosInvalidos(res, { todasParcelas: 'Informe true ou false.' });
  }
  const excluido = todasParcelas === 'true'
    ? await Lancamento.excluirGrupo(req.lancamentoId, req.auth.id)
    : await Lancamento.excluir(req.lancamentoId, req.auth.id);
  if (!excluido) return res.status(404).json({ erro: 'Lançamento não encontrado.' });
  return res.status(204).end();
});

router.use((error, req, res, next) => {
  // O Express decodifica o parâmetro antes de chamar router.param.
  if (error instanceof URIError && error.status === 400) {
    return dadosInvalidos(res, { id: mensagemIdInvalido });
  }
  return next(error);
});

module.exports = router;
