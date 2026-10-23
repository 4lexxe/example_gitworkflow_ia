import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotal } from '../src/pricing.mjs';

test('cobra el precio por la cantidad', () => {
  assert.equal(calculateTotal(10000, 2), 20000);
});
test('descuenta sobre el subtotal', () => {
  assert.equal(calculateTotal(10000, 2, 10), 18000);
});
test('permite descuento completo y precio cero', () => {
  assert.equal(calculateTotal(10000, 3, 100), 0);
  assert.equal(calculateTotal(0, 2, 15), 0);
});
test('redondea a centavos', () => {
  assert.equal(calculateTotal(999, 1, 15), 849);
});
test('rechaza precios inválidos', () => {
  for (const value of [-1, 1.5, NaN, Infinity, '100']) {
    assert.throws(() => calculateTotal(value, 1), RangeError);
  }
});
test('rechaza cantidades inválidas', () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, '2']) {
    assert.throws(() => calculateTotal(100, value), RangeError);
  }
});
test('rechaza descuentos inválidos', () => {
  for (const value of [-1, 101, NaN, Infinity, '10']) {
    assert.throws(() => calculateTotal(100, 1, value), RangeError);
  }
});
test('rechaza subtotales que pierden precisión', () => {
  assert.throws(() => calculateTotal(Number.MAX_SAFE_INTEGER, 2), RangeError);
});
