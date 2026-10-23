# Resultados verificados

Verificación realizada el **22 de octubre de 2026**, horario de Buenos Aires.

## Recorrido real en GitHub

1. **CI:** se ejecutaron las pruebas y comprobaciones de sintaxis en GitHub Actions.
2. **Kanban:** se publicó GitHub Pages y se comprobó que muestra datos reales de la API.
3. **PM IA:** la [issue #1](https://github.com/4lexxe/example_gitworkflow_ia/issues/1)
   recibió un plan de Copilot con prioridad, criterios y pasos. Pasó a `status:ready`.
4. **Movimiento manual:** `/pm status doing` movió esa tarea a «En curso».
5. **Vinculación:** el [PR #2](https://github.com/4lexxe/example_gitworkflow_ia/pull/2)
   incluyó `Closes #1`; la tarea pasó automáticamente a «En revisión».
6. **Revisión IA:** el modelo señaló dos problemas altos: falta de validación del
   envío y falta de comprobación del total final como entero seguro.
7. **Separación de resultados:** CI pasó con las pruebas previas; `AI / review`
   falló por los problemas encontrados. El check fallido es el resultado esperado
   de esta demostración.

El código defectuoso está en la rama del PR de demostración; `main` conserva
la implementación original sin parámetro de envío.

## Comprobaciones locales

25 pruebas automatizadas de la aplicación y la coordinación del bot, incluyendo:

- Entradas inválidas y desbordamiento del cálculo.
- Comandos restringidos a mantenedores y respuestas del modelo validadas.
- Fallos de acceso a IA visibles, sin publicar un éxito falso.
- Revisiones descartadas si cambia el commit durante el análisis.
- Cobertura parcial declarada y revisión pospuesta para PRs en borrador.
- Comentarios actualizables sin sobrescribir mensajes de personas.

Los workflows también se revisaron con actionlint 1.7.12. Esa versión todavía no
reconoce el permiso `copilot-requests`; se excluyó solo ese diagnóstico y GitHub
validó y ejecutó correctamente el workflow con ese permiso.

## Acceso y límites

Copilot respondió desde Actions usando su token temporal: no se guardó ningún
secreto nuevo de IA. La disponibilidad futura depende del acceso y los créditos
de la cuenta Copilot.

La integración opcional con GitHub Projects está implementada, pero **no fue
activada ni verificada en vivo**: la sesión `gh` no tiene el permiso `project`.
El Kanban publicado funciona con issues y etiquetas y no necesita ese permiso.
Los pasos para habilitar Projects están en [ACTIVACION.md](ACTIVACION.md).

La respuesta del modelo no es determinista. Revisá sus ejemplos y conclusiones;
las pruebas y la revisión humana siguen formando parte del proceso.
