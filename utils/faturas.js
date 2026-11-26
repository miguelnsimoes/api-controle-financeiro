function dataAjustada(ano, mes, dia) {
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(dia, ultimoDia)));
}

function datasDaFatura(ano, mesFechamento, cartao) {
  const { diaFechamento, diaVencimento } = cartao;
  const mesVencimento = mesFechamento + (diaVencimento <= diaFechamento ? 1 : 0);
  return {
    fechamento: dataAjustada(ano, mesFechamento, diaFechamento),
    vencimento: dataAjustada(ano, mesVencimento, diaVencimento),
  };
}

function mesDaPrimeiraFatura(data, diaFechamento) {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth();
  const fechamento = dataAjustada(ano, mes, diaFechamento);
  return mes + (data >= fechamento ? 1 : 0);
}

function calcularFatura(dataCompra, cartao, numeroParcela = 1) {
  const compra = new Date(dataCompra + 'T00:00:00Z');
  const mesFechamento = mesDaPrimeiraFatura(compra, cartao.diaFechamento) + numeroParcela - 1;
  return datasDaFatura(compra.getUTCFullYear(), mesFechamento, cartao);
}

function periodoDaPrevisao(agora, cartao, meses) {
  const ano = agora.getUTCFullYear();
  const primeiroMes = mesDaPrimeiraFatura(agora, cartao.diaFechamento);
  return Array.from({ length: meses }, (_, indice) => datasDaFatura(ano, primeiroMes + indice, cartao));
}

function dataISO(data) {
  return data.toISOString().slice(0, 10);
}

function inicioDosLancamentosPossiveis(agora) {
  // Até 1 mês até o primeiro fechamento, 47 entre parcelas e 1 até vencer.
  return dataISO(new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 49, 1)));
}

function emCentavos(decimal) {
  const [inteiro, fracao = ''] = decimal.split('.');
  return BigInt(inteiro + fracao.padEnd(2, '0'));
}

function comoNumero(centavos) {
  const absoluto = centavos < 0n ? -centavos : centavos;
  const fracao = String(absoluto % 100n).padStart(2, '0');
  const sinal = centavos < 0n ? '-' : '';
  return Number(`${sinal}${absoluto / 100n}.${fracao}`);
}

function montarPrevisao(linhas, meses, agora = new Date()) {
  const hoje = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate());
  const cartoes = new Map();
  for (const linha of linhas) {
    if (!cartoes.has(linha.cartao_id)) {
      const cartao = {
        id: linha.cartao_id,
        nome: linha.cartao_nome,
        diaFechamento: linha.dia_fechamento,
        diaVencimento: linha.dia_vencimento,
        limiteTotal: emCentavos(linha.limite),
        limiteUtilizado: 0n,
        faturas: new Map(),
      };
      for (const { fechamento, vencimento } of periodoDaPrevisao(agora, cartao, meses)) {
        cartao.faturas.set(+fechamento, {
          referencia: dataISO(vencimento).slice(0, 7),
          fechamento: dataISO(fechamento),
          vencimento: dataISO(vencimento),
          total: 0n,
          lancamentos: [],
        });
      }
      cartoes.set(cartao.id, cartao);
    }

    if (linha.lancamento_id === null) continue;
    const cartao = cartoes.get(linha.cartao_id);
    const { fechamento, vencimento } = calcularFatura(linha.data, cartao, linha.parcela_atual);
    const valor = emCentavos(linha.valor);
    if (vencimento >= hoje) cartao.limiteUtilizado += valor;

    const fatura = cartao.faturas.get(+fechamento);
    if (fatura) {
      fatura.total += valor;
      fatura.lancamentos.push({
        id: linha.lancamento_id,
        descricao: linha.descricao,
        data: linha.data,
        parcela: `${linha.parcela_atual}/${linha.total_parcelas}`,
        valor: comoNumero(valor),
      });
    }
  }

  return Array.from(cartoes.values(), (cartao) => ({
    id: cartao.id,
    nome: cartao.nome,
    limiteTotal: comoNumero(cartao.limiteTotal),
    limiteUtilizado: comoNumero(cartao.limiteUtilizado),
    limiteDisponivel: comoNumero(cartao.limiteTotal - cartao.limiteUtilizado),
    faturas: Array.from(cartao.faturas.values(), (fatura) => ({
      ...fatura,
      total: comoNumero(fatura.total),
    })),
  }));
}

module.exports = { calcularFatura, inicioDosLancamentosPossiveis, montarPrevisao, periodoDaPrevisao };
