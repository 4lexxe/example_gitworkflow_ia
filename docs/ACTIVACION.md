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

## 3. Kanban nativo de GitHub Projects

El tablero está en [Workflow Lab IA](https://github.com/users/4lexxe/projects/2).
Usa la plantilla Kanban de GitHub, con cinco estados y las issues/PRs del repo.
El enlace anterior de Pages redirige al Project nativo.

La variable `PROJECT_NUMBER` vale `2`. Para que Actions sincronice los movimientos:

1. Creá un **personal access token clásico** con permiso **project** y vencimiento.
2. Guardalo como `PROJECT_TOKEN` en
   [los secretos de Actions](https://github.com/4lexxe/example_gitworkflow_ia/settings/secrets/actions).
3. Ejecutá la sincronización inicial:

```powershell
gh workflow run project-manager.yml --repo 4lexxe/example_gitworkflow_ia -f operation=sync-project
```

Este repositorio es público: el token solo necesita `project`. Para un repositorio
privado se requiere además `repo`. GitHub todavía no admite tokens fine-grained
para Projects de cuentas personales. [Limitaciones oficiales](https://docs.github.com/en/authentication/keeping-your-personal-access-tokens-and-other-credentials-secure/managing-your-personal-access-tokens).

Nunca pegues el token en una issue, PR o chat. El código de análisis no recibe
`PROJECT_TOKEN`; se usa exclusivamente al publicar los movimientos del tablero.
`GITHUB_TOKEN` está limitado al repositorio y no accede a Projects.

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

## 5. Reutilizar la configuración en otra instalación

`scripts/setup-project.mjs` reutiliza un Project existente con el mismo nombre o
crea uno nuevo. Conserva las opciones de estado y sus IDs cuando el tablero ya
tiene los cinco estados de la plantilla Kanban. Requiere `project` en tu sesión:

```powershell
gh auth refresh -s project
node scripts/setup-project.mjs
```

El script configura `PROJECT_NUMBER` y `PROJECT_URL`, vincula el repo y agrega los
elementos existentes. La sincronización permanente usa el secreto descrito arriba.

Referencia: [Automatizar Projects con Actions](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions).
