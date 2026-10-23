# Activación y diagnóstico

## 1. GitHub Actions y etiquetas

Actions debe estar habilitado. El workflow «Project Manager y revisor IA» tiene
una operación manual `setup` que crea/actualiza las etiquetas. Se ejecuta una
vez antes de crear la primera tarea.

```powershell
gh workflow run project-manager.yml --repo 4lexxe/example_gitworkflow_ia -f operation=setup
```

## 2. Acceso de la IA

El gestor instala la versión fijada de Copilot CLI y primero usa el token temporal
de GitHub Actions con `copilot-requests: write`. En un repositorio personal,
GitHub atribuye el uso al acceso Copilot del propietario. Se necesita acceso
válido a Copilot; la ejecución puede consumir créditos de ese servicio.

Si la ejecución informa un error de autenticación o de acceso:

1. Comprobá tu [configuración de Copilot](https://github.com/settings/copilot).
2. Creá un **fine-grained personal access token** con el permiso de cuenta
   **Copilot Requests**, según la [documentación de autenticación](https://docs.github.com/en/copilot/how-tos/copilot-cli/automate-copilot-cli/automate-with-actions).
3. Guardalo como `COPILOT_GITHUB_TOKEN` en
   [Settings → Secrets and variables → Actions](https://github.com/4lexxe/example_gitworkflow_ia/settings/secrets/actions).
4. Comentá `/pm plan` en una issue o `/pm review` en un PR.

También podés guardarlo con el CLI, que solicita el valor sin ponerlo en archivos:

```powershell
gh secret set COPILOT_GITHUB_TOKEN --repo 4lexxe/example_gitworkflow_ia
```

No uses el token general de tu sesión `gh` como secreto del repositorio. El gestor
ya dispone de su token temporal para etiquetas y comentarios; el secreto adicional
solo necesita acceso a las consultas Copilot.

**Sin credenciales válidas no hay análisis IA.** Los tests, etiquetas de estado
y tablero son componentes distintos; un CI verde no prueba que el modelo haya
respondido. La evidencia de IA es el comentario con el plan o la revisión y la
ejecución correspondiente.

GitHub Models fue retirado el 30 de julio de 2026; este proyecto no depende de
esa API. [Aviso oficial](https://docs.github.com/en/github-models).

## 3. Publicación del Kanban

En Settings → Pages, la fuente debe ser **GitHub Actions**. El workflow
«Publicar Kanban» despliega `docs/`. La dirección es:

https://4lexxe.github.io/example_gitworkflow_ia/

Las tarjetas se leen en tiempo real desde issues y PRs públicos. Los cambios de
estado no requieren otro despliegue. Si GitHub limita las consultas anónimas,
el tablero lo informa y mantiene la última vista; esperá antes de actualizar.

## 4. Protección de main

La configuración verificada exige un PR y los checks **Tests** y **AI / review** antes del merge,
descarta aprobaciones obsoletas e impide borrar o forzar pushes a main.
En un repositorio de una sola persona, se permiten cero aprobaciones externas
obligatorias para que puedas fusionar tu propio PR después de revisarlo.

El estado **AI / review** muestra si la revisión terminó, falló o encontró
problemas altos. Se activó como obligatorio después de verificar el acceso real
al modelo. Un error de autenticación, cobertura parcial o hallazgo alto impide
el merge. En contribuciones externas, un mantenedor pide la revisión con
`/pm review` antes de fusionar. No hay aprobaciones IA ni merges automáticos.

## 5. GitHub Projects opcional

El tablero incluido ya cumple la función de Kanban. Para usar además Projects
nativo se requiere un token con acceso a Projects; `GITHUB_TOKEN` solo tiene
alcance de repositorio y no puede administrarlo.

El script `scripts/setup-project.mjs` crea y vincula un proyecto, configura cinco
estados y agrega las issues existentes. Requiere autorizar `project` en tu sesión:

```powershell
gh auth refresh -s project
node scripts/setup-project.mjs
```

Para sincronizarlo desde Actions, guardá un PAT de Projects con alcance `project`
y `repo` como `PROJECT_TOKEN`. El script configura `PROJECT_NUMBER` como variable
del repositorio y la automatización sincroniza el estado tras cada movimiento.
El token de Projects nunca se entrega al modelo.

Referencia: [Automatizar Projects con Actions](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions).
