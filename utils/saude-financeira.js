
const { calcularFatura } = require('./faturas');

function arredondar(valor) {
  return Math.round(valor * 100) / 100;
}

function mesReferencia(data, deslocamento = 0) {
  return new Date(Date.UTC(
    data.getUTCFullYear(),
    data.getUTCMonth() + deslocamento,
    1
  )).toISOString().slice(0, 7);
}

function inicioHistorico(agora = new Date()) {
  return `${mesReferencia(agora, -52)}-01`;
}

function analisarSaudeFinanceira(linhas, agora = new Date()) {
  const mesAtual = mesReferencia(agora);
  const hoje = agora.toISOString().slice(0, 10);
  const movimentacoes = new Map();
  const parcelasFuturas = new Map();
  let totalParcelasFuturas = 0;

  function obterMes(mes) {
    if (!movimentacoes.has(mes)) {
      movimentacoes.set(mes, {
        entradas: 0,
        saidas: 0,
        cartoes: 0,
        saidasSemParcelas: 0,
      });
    }

    return movimentacoes.get(mes);
  }

  for (const linha of linhas) {
    const valor = Math.round(Number(linha.valor) * 100);
    let dataEfetiva = linha.data;

    const cartao =
      linha.tipo_fonte === 'cartao_credito' &&
      linha.tipo === 'saida';

    const parcelado = cartao && linha.total_parcelas > 1;

    if (cartao) {
      const fatura = calcularFatura(
        linha.data,
        {
          diaFechamento: linha.dia_fechamento,
          diaVencimento: linha.dia_vencimento,
        },
        linha.parcela_atual
      );

      dataEfetiva = fatura.vencimento.toISOString().slice(0, 10);
    }

    const mes = dataEfetiva.slice(0, 7);
    const registro = obterMes(mes);

    if (linha.tipo === 'entrada') {
      registro.entradas += valor;
    } else {
      registro.saidas += valor;

      if (cartao) {
        registro.cartoes += valor;
      }

      if (!parcelado) {
        registro.saidasSemParcelas += valor;
      }
    }

    if (parcelado && dataEfetiva >= hoje) {
      totalParcelasFuturas += valor;

      parcelasFuturas.set(
        mes,
        (parcelasFuturas.get(mes) || 0) + valor
      );
    }
  }

  // Histórico dos últimos três meses completos.
  const historico = [-3, -2, -1].map(
    (offset) => obterMes(mesReferencia(agora, offset))
  );

  const mediaEntradas = historico.reduce(
    (total, mes) => total + mes.entradas, 0
  ) / 3;

  const mediaSaidas = historico.reduce(
    (total, mes) => total + mes.saidasSemParcelas, 0
  ) / 3;

  const atual = obterMes(mesAtual);

  // Indicador 1: taxa de poupança.
  const taxaPoupanca = atual.entradas > 0
    ? arredondar(
        (atual.entradas - atual.saidas) / atual.entradas
      )
    : null;

  // Indicador 2: comprometimento com cartões.
  const totalProximasFaturas = [1, 2, 3].reduce(
    (total, offset) =>
      total + obterMes(mesReferencia(agora, offset)).cartoes,
    0
  );

  const comprometimentoCartoes = mediaEntradas > 0
    ? arredondar(totalProximasFaturas / mediaEntradas)
    : null;

  // Projeção dos próximos seis meses.
  const projecao = Array.from({ length: 6 }, (_, indice) => {
    const mes = mesReferencia(agora, indice + 1);
    const parcelas = parcelasFuturas.get(mes) || 0;
    const saidas = mediaSaidas + parcelas;

    return {
      mes,
      entradas: arredondar(mediaEntradas / 100),
      saidas: arredondar(saidas / 100),
      parcelas: arredondar(parcelas / 100),
      saldoPrevisto: arredondar(
        (mediaEntradas - saidas) / 100
      ),
    };
  });

  // Dicas educativas baseadas nos indicadores.
  const dicas = [];

  if (taxaPoupanca === null) {
    dicas.push(
      'Não há entradas registradas no mês para calcular a taxa de poupança.'
    );
  } else if (taxaPoupanca < 0) {
    dicas.push(
      'Suas despesas superam suas entradas no mês analisado.'
    );
  } else if (taxaPoupanca < 0.1) {
    dicas.push(
      'Sua taxa de poupança está abaixo da referência educativa de 10%.'
    );
  } else {
    dicas.push(
      'Sua taxa de poupança atingiu a referência educativa de 10%.'
    );
  }

  if (comprometimentoCartoes !== null &&
      comprometimentoCartoes > 0.3) {
    dicas.push(
      'As faturas dos próximos três meses superam 30% de uma renda média mensal.'
    );
  }

  if (totalParcelasFuturas > 0) {
    dicas.push(
      `Você possui R$ ${(totalParcelasFuturas / 100).toFixed(2)} em parcelas a vencer.`
    );
  }

  for (const mes of projecao) {
    if (mes.saldoPrevisto < 0) {
      dicas.push(
        `O saldo previsto para ${mes.mes} é negativo.`
      );
    }
  }

  if (mediaEntradas === 0) {
    dicas.push(
      'O histórico não possui entradas suficientes para uma projeção confiável.'
    );
  }

  return {
    aviso: 'Informações educativas; não constituem recomendação financeira profissional.',
    mesReferencia: mesAtual,
    indicadores: {
      taxaPoupanca,
      comprometimentoCartoes,
      totalParcelasFuturas: arredondar(
        totalParcelasFuturas / 100
      ),
      parcelasPorMes: Array.from(
        parcelasFuturas,
        ([mes, valor]) => ({
          mes,
          total: arredondar(valor / 100),
        })
      ).sort((a, b) => a.mes.localeCompare(b.mes)),
    },
    projecao,
    dicas,
  };
}

module.exports = {
  analisarSaudeFinanceira,
  inicioHistorico,
};
