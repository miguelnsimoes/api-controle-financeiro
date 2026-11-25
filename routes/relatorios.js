const express = require('express');
const Relatorio = require('../models/Relatorio');
const { inicioDosLancamentosPossiveis, montarPrevisao } = require('../utils/faturas');

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

  const mapaAnterior = new Map(
    anteriores
      .filter((linha) => linha.tipo === tipo)
      .map((linha) => [linha.id, linha.total])
  );

  const categorias = atuais.map(({ id, nome, total: valor }) => {
    const anterior = mapaAnterior.get(id) || 0;

    return {
      id,
      nome,
      total: valor,
      percentual: total === 0 ? 0 : arredondar((valor / total) * 100),
      anterior,
      variacao: anterior === 0 ? null : arredondar(((valor - anterior) / anterior) * 100),
    };
  });

  categorias.sort((a, b) => b.total - a.total || a.id - b.id);

  return { total, categorias };
}

// Validação compartilhada pelos relatórios
function validarPeriodo(inicio, fim) {
  const erros = {};
  const dataInicio = interpretarData(inicio);
  const dataFim = interpretarData(fim);

  if (!dataInicio) {
    erros.inicio = 'Informe uma data válida no formato AAAA-MM-DD.';
  }

  if (!dataFim) {
    erros.fim = 'Informe uma data válida no formato AAAA-MM-DD.';
  }

  if (dataInicio && dataFim && dataInicio > dataFim) {
    erros.fim = 'A data final não pode ser anterior à data inicial.';
  }

  return { erros, dataInicio, dataFim };
}

// Issue #12 - Relatório por categorias
router.get('/categorias', async (req, res, next) => {
  const { inicio, fim } = req.query;
  const { erros, dataInicio, dataFim } = validarPeriodo(inicio, fim);

  if (Object.keys(erros).length) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      campos: erros,
    });
  }

  const dias = Math.round((dataFim - dataInicio) / DIA_MS) + 1;
  const fimAnterior = new Date(dataInicio.getTime() - DIA_MS);
  const inicioAnterior = new Date(dataInicio.getTime() - dias * DIA_MS);

  // O MySQL DATE aceita anos a partir de 1000.
  if (inicioAnterior.getUTCFullYear() < 1000) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      campos: {
        inicio: 'O período anterior deve estar dentro do intervalo de datas do MySQL.',
      },
    });
  }

  const periodoAnterior = {
    inicio: dataISO(inicioAnterior),
    fim: dataISO(fimAnterior),
  };

  try {
    const [atuais, anteriores] = await Promise.all([
      Relatorio.totaisPorCategoria(req.auth.id, inicio, fim),
      Relatorio.totaisPorCategoria(
        req.auth.id,
        periodoAnterior.inicio,
        periodoAnterior.fim
      ),
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

// Issue #13 - Relatório por fontes e destinos
router.get('/fontes-destinos', async (req, res, next) => {
  const { inicio, fim } = req.query;
  const { erros } = validarPeriodo(inicio, fim);

  if (Object.keys(erros).length) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      campos: erros,
    });
  }

  try {
    const linhas = await Relatorio.totaisPorFonteDestino(
      req.auth.id,
      inicio,
      fim
    );

    const entradas = linhas
      .filter((linha) => linha.entradas > 0)
      .map((linha) => ({
        id: linha.id,
        nome: linha.nome,
        tipo: linha.tipo,
        total: arredondar(linha.entradas),
      }))
      .sort((a, b) => b.total - a.total || a.id - b.id);

    const saidas = linhas
      .filter((linha) => linha.saidas > 0)
      .map((linha) => ({
        id: linha.id,
        nome: linha.nome,
        tipo: linha.tipo,
        total: arredondar(linha.saidas),
      }))
      .sort((a, b) => b.total - a.total || a.id - b.id);

    const contas = linhas
      .filter((linha) => linha.tipo === 'conta')
      .map((linha) => ({
        id: linha.id,
        nome: linha.nome,
        entradas: arredondar(linha.entradas),
        saidas: arredondar(linha.saidas),
        saldo: arredondar(linha.entradas - linha.saidas),
      }));

    return res.status(200).json({
      periodo: { inicio, fim },
      entradas,
      saidas,
      contas,
    });
  } catch (erro) {
    return next(erro);
  }
});

router.get('/faturas', async (req, res) => {
  const { meses = '3' } = req.query;
  if (typeof meses !== 'string' || !/^(?:[1-9]|1[0-2])$/.test(meses)) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      campos: { meses: 'Informe um número inteiro entre 1 e 12.' },
    });
  }
  const agora = new Date();
  const linhas = await Relatorio.lancamentosDosCartoes(req.auth.id, inicioDosLancamentosPossiveis(agora));
  return res.json({ cartoes: montarPrevisao(linhas, Number(meses), agora) });
});

module.exports = router;
