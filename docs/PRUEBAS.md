# Probar el flujo completo

El tablero es [GitHub Projects nativo](https://github.com/users/4lexxe/projects/2).
Los comandos `/pm ...` se publican como **comentario aparte**, después de crear la
issue; los campos del formulario solo describen la tarea y no ejecutan comandos.

## Prueba A: comprobar al Project Manager

1. Abrí [Nueva tarea](https://github.com/4lexxe/example_gitworkflow_ia/issues/new?template=tarea.yml).
2. Usá este objetivo:

   > Agregar un cuarto parámetro opcional shippingCents a calculateTotal.
   > Se suma después del descuento y el valor por defecto es 0.

3. Usá estos criterios:

   > El envío debe ser un entero no negativo en centavos. Rechazar números
   > negativos, decimales, NaN, Infinity y strings. Mantener los llamados
   > anteriores. Probar calculateTotal(10000, 2, 10, 500) = 18500.
   > Rechazar totales que excedan Number.MAX_SAFE_INTEGER.

4. Esperá el workflow «Project Manager y revisor IA». Debe aparecer un comentario
   «Plan del Project Manager IA», con prioridad, criterios y pasos. La tarjeta
   debe pasar de **Backlog** a **Listo para empezar** y tener `ai:planned`.
5. Si aparece `ai:unavailable`, seguí [ACTIVACION.md](ACTIVACION.md). Después
   comentá `/pm plan`. No confundas esa etiqueta con un análisis terminado.
6. Comentá `/pm status doing` y comprobá el cambio en el Kanban.

Guardá el número real de tu issue: se usa como `N` en los pasos siguientes.

## Prueba B: comprobar al revisor con un defecto nuevo

En tu copia local:

```powershell
git switch main
git pull --ff-only
git switch -c prueba/envio
```

Editá `src/pricing.mjs` para agregar el cuarto parámetro:

```javascript
export function calculateTotal(unitPriceCents, quantity, discountPercent = 0, shippingCents = 0) {
```

Y cambiá el retorno por:

```javascript
return Math.round(subtotal * (1 - discountPercent / 100)) + shippingCents;
```

Esta implementación **omite intencionalmente la validación del envío**. Es para
la rama de prueba. Las pruebas anteriores pueden pasar porque el nuevo parámetro
vale 0 por defecto; por eso sirven los nuevos criterios y la revisión.

```powershell
npm test
git add src/pricing.mjs
git commit -m "feat: agregar envío al total"
git push -u origin prueba/envio
```

Abrí un PR hacia `main`. Describí el objetivo y poné **`Closes #N` con el número
real de la issue**, en una línea de la descripción.

Comprobá:

- La tarjeta de la issue pasa a **En revisión**.
- CI ejecuta las pruebas.
- La IA publica «Revisión de código por IA» con el SHA actual.
- El revisor debería señalar que un envío negativo, NaN o texto produce un
  total inválido, y proponer validación. La respuesta exacta no es determinista.
- Un hallazgo alto pone **AI / review** en rojo. Los medios también aparecen
  en el comentario, aunque ese estado no se pone rojo por severidad media.

Un check verde de CI solo significa que pasaron las pruebas existentes. Para
comprobar el comportamiento nuevo, agregá estas pruebas antes de corregirlo:

```javascript
test('valida el envío', () => {
  assert.equal(calculateTotal(10000, 2, 10, 500), 18500);
  for (const shipping of [-1, 1.5, NaN, Infinity, '500']) {
    assert.throws(() => calculateTotal(10000, 2, 10, shipping), RangeError);
  }
});
```

## Prueba C: corregir y completar

Validá `shippingCents` con `Number.isSafeInteger` y comprobá el total final.
Agregá también pruebas para cero, valor por defecto y desbordamiento.
Hacé commit y push en **la misma rama**. Se ejecutan de nuevo CI y la revisión.
El comentario del revisor debe actualizarse al nuevo SHA.

Cuando cumpla los criterios, revisá los resultados y fusioná con squash. GitHub
cierra la issue por `Closes #N`; la tarjeta aparece en **Hecho**. Si cerrás el PR
sin fusionar, la issue abierta vuelve a **En curso**.

## Prueba D: comprobar que el PM entiende otra tarea

Creá una issue con este texto:

> Quiero aplicar un cupón de descuento fijo en centavos. No debe dejar el
> total negativo y debe combinarse con el descuento porcentual en un orden
> definido. Todavía no decidí cuál se aplica primero.

El PM debería proponer criterios y preguntar por el orden de aplicación. Esto
te permite evaluar su comprensión sin depender del ejemplo del envío.

## Evidencia que conviene mirar

| Elemento | Qué demuestra |
| --- | --- |
| Comentario del PM y `ai:planned` | El modelo respondió con un plan válido. |
| Comentario del revisor con SHA | El modelo analizó esa versión del cambio. |
| Check Tests | Las comprobaciones reproducibles pasaron o fallaron. |
| Etiquetas `status:*` y Kanban | La coordinación de estados funcionó. |
| `ai:unavailable` y ejecución fallida | Faltó acceso o falló el análisis; requiere atención. |
