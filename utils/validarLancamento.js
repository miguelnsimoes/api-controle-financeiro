const idMaximo = 2147483647;

function idValido(id) {
  return Number.isInteger(id) && id > 0 && id <= idMaximo;
}

function dataValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data) || data < '1000-01-01') {
    return false;
  }
  const parsed = new Date(data + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === data;
}

function dividirEmParcelas(valor, quantidade) {
  const centavos = Math.round(valor * 100);
  const base = Math.floor(centavos / quantidade);
  const resto = centavos % quantidade;
  return Array.from({ length: quantidade }, (_, i) => (base + (i === 0 ? resto : 0)) / 100);
}

function validarFiltrosLancamentos(query, agora = new Date()) {
  let { inicio = null, fim = null } = query;
  const { tipo = null, pagina: paginaInformada = '1' } = query;
  const pagina = Number(paginaInformada);
  const campos = {};

  if (inicio !== null && !dataValida(inicio)) campos.inicio = 'Informe uma data válida no formato AAAA-MM-DD.';
  if (fim !== null && !dataValida(fim)) campos.fim = 'Informe uma data válida no formato AAAA-MM-DD.';
  if (inicio && fim && !campos.inicio && !campos.fim && inicio > fim) {
    campos.fim = 'A data final deve ser igual ou posterior à inicial.';
  }
  if (tipo !== null && !['entrada', 'saida'].includes(tipo)) campos.tipo = 'O tipo deve ser entrada ou saida.';
  if (typeof paginaInformada !== 'string' || !/^\d+$/.test(paginaInformada)
      || !Number.isSafeInteger(pagina) || pagina < 1) {
    campos.pagina = 'Informe um número de página inteiro positivo válido.';
  }

  const ids = { categoriaId: null, fonteDestinoId: null };
  for (const campo of Object.keys(ids)) {
    const valor = query[campo];
    if (valor === undefined) continue;
    if (typeof valor !== 'string' || !/^\d+$/.test(valor) || !idValido(Number(valor))) {
      campos[campo] = 'Informe um identificador válido.';
    } else {
      ids[campo] = Number(valor);
    }
  }
  if (Object.keys(campos).length) return { campos };

  if (inicio === null && fim === null) {
    const ano = agora.getUTCFullYear();
    const mes = agora.getUTCMonth();
    inicio = agora.toISOString().slice(0, 7) + '-01';
    fim = new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10);
  }
  return { filtros: { inicio, fim, tipo, ...ids, pagina } };
}

function validarLancamento(corpo, criacao = false) {
  const { tipo, descricao, valor, data, categoriaId, fonteDestinoId } = corpo || {};
  const campos = {};
  const descricaoLimpa = typeof descricao === 'string' ? descricao.trim() : '';

  if (!['entrada', 'saida'].includes(tipo)) {
    campos.tipo = 'O tipo deve ser entrada ou saida.';
  }
  if (!descricaoLimpa || [...descricaoLimpa].length > 120) {
    campos.descricao = 'Informe uma descrição de 1 a 120 caracteres.';
  }
  if (!Number.isFinite(valor) || valor < 0.01 || valor > 9999999999.99
      || !/^\d+(\.\d{1,2})?$/.test(String(valor))) {
    campos.valor = 'Informe um valor numérico positivo com até dez dígitos inteiros e duas casas decimais.';
  }
  if (!dataValida(data)) {
    campos.data = 'Informe uma data válida no formato AAAA-MM-DD.';
  }
  if (!idValido(categoriaId)) {
    campos.categoriaId = 'Informe um identificador válido.';
  }
  if (!idValido(fonteDestinoId)) {
    campos.fonteDestinoId = 'Informe um identificador válido.';
  }
  const parcelas = criacao ? corpo?.parcelas : undefined;
  if (parcelas !== undefined) {
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48) {
      campos.parcelas = 'Informe um número inteiro de parcelas entre 1 e 48.';
    } else if (!campos.valor && Math.round(valor * 100) < parcelas) {
      campos.parcelas = 'O valor deve permitir pelo menos um centavo por parcela.';
    }
  }
  if (Object.keys(campos).length) return { campos };

  const dados = { tipo, descricao: descricaoLimpa, valor, data, categoriaId, fonteDestinoId };
  if (parcelas !== undefined) dados.parcelas = parcelas;
  return { dados };
}

module.exports = { dividirEmParcelas, idValido, validarFiltrosLancamentos, validarLancamento };
