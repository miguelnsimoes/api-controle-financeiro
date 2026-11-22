const express = require('express');
const Relatorio = require('../models/Relatorio');

const router = express.Router();
const DIA_MS = 24 * 60 * 60 * 1000;

function interpretarData(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (ano < 1000 || data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    return null;
  }
  return data;
}

function dataISO(data) {
  return data.toISOString().slice(0, 10);
}

function arredondar(valor) {
  return Math.round((valor + Math.sign(valor) * 1e-9) * 100) / 100;
}

function resumir(linhas, anteriores, tipo) {
  const atuais = linhas.filter((linha) => linha.tipo === tipo);
  const total = arredondar(atuais.reduce((soma, linha) => soma + linha.total, 0));
  const mapaAnterior = new Map(anteriores.filter((linha) => linha.tipo === tipo).map((linha) => [linha.id, linha.total]));
  const categorias = atuais.map(({ id, nome, total: valor }) => {
    const anterior = mapaAnterior.get(id) || 0;
    return {
      id, nome, total: valor,
      percentual: total === 0 ? 0 : arredondar((valor / total) * 100),
      anterior,
      variacao: anterior === 0 ? null : arredondar(((valor - anterior) / anterior) * 100),
    };
  });
  categorias.sort((a, b) => b.total - a.total || a.id - b.id);
  return { total, categorias };
}

router.get('/categorias', async (req, res, next) => {
  const { inicio, fim } = req.query;
  const erros = {};
  const dataInicio = interpretarData(inicio);
  const dataFim = interpretarData(fim);
  if (!dataInicio) erros.inicio = 'Informe uma data válida no formato AAAA-MM-DD.';
  if (!dataFim) erros.fim = 'Informe uma data válida no formato AAAA-MM-DD.';
  if (dataInicio && dataFim && dataInicio > dataFim) {
    erros.fim = 'A data final não pode ser anterior à data inicial.';
  }
  if (Object.keys(erros).length) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos: erros });
  }

  const dias = Math.round((dataFim - dataInicio) / DIA_MS) + 1;
  const fimAnterior = new Date(dataInicio.getTime() - DIA_MS);
  const inicioAnterior = new Date(dataInicio.getTime() - dias * DIA_MS);
  // O MySQL DATE aceita anos a partir de 1000.
  if (inicioAnterior.getUTCFullYear() < 1000) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      campos: { inicio: 'O período anterior deve estar dentro do intervalo de datas do MySQL.' },
    });
  }
  const periodoAnterior = { inicio: dataISO(inicioAnterior), fim: dataISO(fimAnterior) };

  try {
    const [atuais, anteriores] = await Promise.all([
      Relatorio.totaisPorCategoria(req.auth.id, inicio, fim),
      Relatorio.totaisPorCategoria(req.auth.id, periodoAnterior.inicio, periodoAnterior.fim),
    ]);
    return res.status(200).json({
      periodo: { inicio, fim },
      periodoAnterior,
      saidas: resumir(atuais, anteriores, 'saida'),
      entradas: resumir(atuais, anteriores, 'entrada'),
    });
  } catch (erro) {
    return next(erro);
  }
});

module.exports = router;
