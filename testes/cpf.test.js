const test = require('node:test');
const assert = require('node:assert/strict');
const { cpfValido } = require('../utils/cpf');

test('aceita CPF válido com ou sem pontuação', () => {
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('52998224725'), true);
});

test('rejeita alteração de qualquer dígito verificador', () => {
  assert.equal(cpfValido('52998224715'), false);
  assert.equal(cpfValido('52998224724'), false);
});

test('rejeita CPFs repetidos, incompletos e ausentes', () => {
  for (let digito = 0; digito <= 9; digito++) {
    assert.equal(cpfValido(String(digito).repeat(11)), false);
  }
  for (const cpf of ['', '123', '529982247255', null, undefined]) {
    assert.equal(cpfValido(cpf), false);
  }
});
