import { calculateTotal } from '../src/pricing.mjs';

console.log('2 productos de $100, con 10% de descuento:');
console.log(`Total: $${(calculateTotal(10000, 2, 10) / 100).toFixed(2)}`);
