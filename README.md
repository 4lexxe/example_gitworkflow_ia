# Workflow Lab: GitHub + Project Manager IA

[![CI](https://github.com/4lexxe/example_gitworkflow_ia/actions/workflows/ci.yml/badge.svg)](https://github.com/4lexxe/example_gitworkflow_ia/actions/workflows/ci.yml)

Un laboratorio para recorrer **tarea → planificación IA → implementación → PR → revisión IA → pruebas → merge**.

**[Abrir Kanban en GitHub Projects](https://github.com/users/4lexxe/projects/2)** ·
**[Crear tarea](https://github.com/4lexxe/example_gitworkflow_ia/issues/new?template=tarea.yml)** ·
**[Ver ejecuciones](https://github.com/4lexxe/example_gitworkflow_ia/actions)** ·
**[Probar paso a paso](docs/PRUEBAS.md)**

**Prueba real:** [tarea planificada por IA #1](https://github.com/4lexxe/example_gitworkflow_ia/issues/1)
y [PR #2 con dos defectos detectados](https://github.com/4lexxe/example_gitworkflow_ia/pull/2).
CI pasa, pero la revisión IA bloquea ese PR hasta corregirlo.
[Evidencia y alcance de verificación](docs/RESULTADOS.md).

## Quién hace qué

| Responsable | Trabajo |
| --- | --- |
| Vos / responsable del producto | Definir el objetivo, decidir prioridades finales y aprobar el merge. |
| Project Manager IA | Leer issues y proponer tipo, prioridad, criterios de aceptación y tareas. |
| Desarrollador humano o asistido por IA | Implementar en una rama y abrir el PR con `Closes #N`. |
| Revisor IA | Analizar los diffs y las tareas vinculadas; publicar problemas y sugerencias. |
| GitHub Actions / CI | Ejecutar las pruebas y comprobaciones reproducibles. |
| GitHub Projects | Mostrar las tarjetas en el tablero nativo, sincronizadas con los estados del PM. |

La IA usa **GitHub Copilot CLI**. Requiere que la cuenta tenga acceso a Copilot;
si el token de Actions no está habilitado, se configura `COPILOT_GITHUB_TOKEN`.
Los errores de acceso se publican como `ai:unavailable`, sin inventar resultados.
Consultá [ACTIVACION.md](docs/ACTIVACION.md).

## Automatizaciones

- **Issue nueva o editada por un colaborador:** el PM publica o actualiza su plan.
- **PR abierto o actualizado:** se sincronizan estados y la IA revisa el último commit.
- **PR en borrador:** mueve la tarea a «En curso»; la revisión empieza al marcarlo listo.
- **PR vinculado:** con `Closes #N` en el cuerpo, la tarea pasa a «En revisión».
- **Merge a main:** GitHub cierra la issue vinculada y pasa a «Hecho».
- **PR cerrado sin merge:** la tarea abierta vuelve a «En curso» si no tiene otro PR abierto.
- **Issue cerrada:** pasa a «Hecho».

| Comentario de un mantenedor | Acción |
| --- | --- |
| `/pm plan` en una issue | Solicitar o regenerar el plan del PM. |
| `/pm status backlog` | Volver a planificación. |
| `/pm status ready` | Marcar lista para empezar. |
| `/pm status doing` | Marcar implementación en curso. |
| `/pm status review` | Mover a revisión. |
| `/pm review` en un PR | Revisar el commit actual otra vez. |

Los comandos deben ocupar todo el comentario. Las consultas automáticas a la IA
se limitan a propietarios, miembros y colaboradores; un mantenedor puede pedir
el análisis de una contribución externa usando esos comandos.

## Kanban

**Backlog → Listo → En curso → En revisión → Hecho.**

El tablero usa la plantilla Kanban que integra **GitHub Projects**. Está vinculado
al repositorio e incluye issues y pull requests reales. Las automatizaciones
nativas importan nuevos elementos y registran los cierres; Actions sincroniza los
movimientos decididos por el PM mediante `PROJECT_TOKEN`.

Los comandos como `/pm status doing` se escriben en **un comentario separado** de
la issue. Escribirlos dentro de su descripción o del formulario no ejecuta el comando.
También podés arrastrar tarjetas en Projects. Los comandos y los eventos posteriores
de la automatización vuelven a aplicar el estado registrado en las etiquetas.

Si falta el permiso de Projects, la ejecución lo informa y no declara una
sincronización exitosa. Ver [ACTIVACION.md](docs/ACTIVACION.md).

## Comprobar localmente

Requiere Node.js 22 o superior. La aplicación y sus tests no tienen dependencias.

```powershell
git clone https://github.com/4lexxe/example_gitworkflow_ia.git
cd example_gitworkflow_ia
npm test
npm run check
npm run demo
```

La aplicación calcula importes en centavos en `src/pricing.mjs`. La prueba guiada
agrega un costo de envío y permite ver la diferencia entre pasar las pruebas
existentes y cumplir los nuevos criterios de aceptación.

## Archivos para adaptar el sistema

- `.github/prompts/project-manager.md`: responsabilidades y formato del PM.
- `.github/prompts/reviewer.md`: criterios de revisión.
- `automation/bot.mjs`: coordinación y cambios de estado.
- `automation/policy.mjs`: comandos, etiquetas y validación de respuestas.
- `automation/projects.mjs`: sincronización con el tablero nativo.
- `.github/workflows/`: CI, gestión IA y redirección del enlace anterior al Project.

El revisor trabaja con hasta 40 archivos y 28 000 caracteres de diffs. Si falta
un diff o se supera el alcance, lo informa como cobertura parcial. Las pruebas
se ejecutan en un job sin secretos; el gestor usa siempre el código de `main`.
Las revisiones no hacen merge ni modifican el código del PR.
