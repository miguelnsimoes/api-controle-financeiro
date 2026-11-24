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

function validarLancamento(corpo) {
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
  if (Object.keys(campos).length) return { campos };

  return { dados: { tipo, descricao: descricaoLimpa, valor, data, categoriaId, fonteDestinoId } };
}

module.exports = { idValido, validarLancamento };
