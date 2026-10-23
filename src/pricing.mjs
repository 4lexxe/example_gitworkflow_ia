/** Importes en centavos: evita errores de redondeo con dinero. */
export function calculateTotal(unitPriceCents, quantity, discountPercent = 0) {
  if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new RangeError('El precio debe ser un entero no negativo en centavos.');
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError('La cantidad debe ser un entero mayor o igual a 1.');
  }
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw new RangeError('El descuento debe estar entre 0 y 100.');
  }
  const subtotal = unitPriceCents * quantity;
  if (!Number.isSafeInteger(subtotal)) throw new RangeError('El subtotal es demasiado grande.');
  return Math.round(subtotal * (1 - discountPercent / 100));
}
