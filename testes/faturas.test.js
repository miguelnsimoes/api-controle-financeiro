const assert = require('node:assert/strict');
const { test } = require('node:test');
const { calcularFatura, inicioDosLancamentosPossiveis, montarPrevisao, periodoDaPrevisao } = require('../utils/faturas');

function datas(fatura) {
  return [fatura.fechamento, fatura.vencimento].map((data) => data.toISOString().slice(0, 10));
}

test('distribui compras antes, no dia e após o fechamento e aplica o número da parcela', () => {
  const cartao = { diaFechamento: 3, diaVencimento: 10 };
  assert.deepEqual(datas(calcularFatura('2026-11-02', cartao)), ['2026-11-03', '2026-11-10']);
  assert.deepEqual(datas(calcularFatura('2026-11-03', cartao)), ['2026-12-03', '2026-12-10']);
  assert.deepEqual(datas(calcularFatura('2026-11-04', cartao, 2)), ['2027-01-03', '2027-01-10']);

  const visa = { diaFechamento: 25, diaVencimento: 5 };
  assert.deepEqual(datas(calcularFatura('2026-12-28', visa)), ['2027-01-25', '2027-02-05']);
  assert.deepEqual(datas(calcularFatura('2026-12-20', visa, 3)), ['2027-02-25', '2027-03-05']);
});

test('ajusta fechamento e vencimento em meses curtos e anos bissextos', () => {
  const cartao = { diaFechamento: 31, diaVencimento: 31 };
  assert.deepEqual(datas(calcularFatura('2027-02-27', cartao)), ['2027-02-28', '2027-03-31']);
  assert.deepEqual(datas(calcularFatura('2028-02-28', cartao)), ['2028-02-29', '2028-03-31']);
  assert.deepEqual(datas(calcularFatura('2028-02-29', cartao)), ['2028-03-31', '2028-04-30']);

  const mesmoMes = { diaFechamento: 30, diaVencimento: 31 };
  assert.deepEqual(datas(calcularFatura('2028-02-28', mesmoMes)), ['2028-02-29', '2028-02-29']);
});

test('a previsão muda para o próximo fechamento à meia-noite UTC', () => {
  const cartao = { diaFechamento: 25, diaVencimento: 5 };
  assert.deepEqual(periodoDaPrevisao(new Date('2026-12-24T23:59:59Z'), cartao, 2).map(datas), [
    ['2026-12-25', '2027-01-05'],
    ['2027-01-25', '2027-02-05'],
  ]);
  assert.deepEqual(periodoDaPrevisao(new Date('2026-12-25T00:00:00Z'), cartao, 1).map(datas), [
    ['2027-01-25', '2027-02-05'],
  ]);
});

test('o limite inclui fatura fechada até o vencimento e parcelas além da previsão', () => {
  const cartao = {
    cartao_id: 1, cartao_nome: 'Visa', dia_fechamento: 25, dia_vencimento: 5, limite: '1000.00',
  };
  const compra = {
    ...cartao, lancamento_id: 1, descricao: 'Compra', data: '2026-12-20',
    parcela_atual: 1, total_parcelas: 4, valor: '300.00',
  };
  const linhas = Array.from({ length: 4 }, (_, i) => ({
    ...compra, lancamento_id: i + 1, parcela_atual: i + 1,
  }));
  const [ateVencer] = montarPrevisao(linhas, 1, new Date('2027-01-05T23:59:59.999Z'));
  assert.equal(ateVencer.limiteUtilizado, 1200);
  assert.equal(ateVencer.limiteDisponivel, -200);
  assert.equal(ateVencer.faturas.length, 1);
  assert.deepEqual(ateVencer.faturas[0].lancamentos.map(({ parcela }) => parcela), ['2/4']);
  assert.equal(ateVencer.faturas[0].total, 300);
  assert.equal(ateVencer.faturas[0].referencia, '2027-02');

  const [aposVencer] = montarPrevisao(linhas, 1, new Date('2027-01-06T00:00:00Z'));
  assert.equal(aposVencer.limiteUtilizado, 900);
  assert.equal(aposVencer.limiteDisponivel, 100);
});

test('o corte de histórico mantém a 48ª parcela no maior deslocamento possível', () => {
  const hoje = new Date('2031-02-05T00:00:00Z');
  const cartao = { diaFechamento: 25, diaVencimento: 5 };
  assert.equal(inicioDosLancamentosPossiveis(hoje), '2027-01-01');
  assert.deepEqual(datas(calcularFatura('2027-01-25', cartao, 48)), ['2031-01-25', '2031-02-05']);
  assert.deepEqual(datas(calcularFatura('2026-12-31', cartao, 48)), ['2030-12-25', '2031-01-05']);
});

test('agrega além dos centavos seguros antes de converter os resultados em números JSON', () => {
  const linha = {
    cartao_id: 1, cartao_nome: 'Cartão', dia_fechamento: 25, dia_vencimento: 5, limite: '0.03',
    lancamento_id: 1, descricao: 'Compra', data: '2027-01-06',
    parcela_atual: 1, total_parcelas: 1, valor: '9999999999.99',
  };
  const linhas = Array.from({ length: 10000 }, (_, i) => ({ ...linha, lancamento_id: i + 1 }));
  const [cartao] = montarPrevisao(linhas, 1, new Date('2027-01-06T00:00:00Z'));
  assert.equal(cartao.limiteUtilizado, Number('99999999999900.00'));
  assert.equal(cartao.limiteDisponivel, Number('-99999999999899.97'));
  assert.equal(cartao.faturas[0].total, cartao.limiteUtilizado);
});
