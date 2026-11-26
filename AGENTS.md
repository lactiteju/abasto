## Worker Delegation

Cada vez que se delegue trabajo a un worker o subagente, este debe **cargar primero la skill `code-organization`** antes de analizar, modificar o crear código.

La skill debe considerarse parte obligatoria del contexto de implementación para cualquier tarea delegada relacionada con estructura, componentes, módulos, refactors o creación de archivos.

## ui-sdk

Antes de usar ui-sdk, seguir la skill `ui-sdk` si está instalada y leer `abasto-web/node_modules/@ui-sdk/react/docs/llms.txt`. Para construir un componente nuevo, además buscar por encabezado en `abasto-web/node_modules/@ui-sdk/react/docs/core.md` y leer `rendering.md` en la misma carpeta.

## Git Workflow

- Todos los commits se hacen **siempre en la rama `dev`**. Nunca commitear directamente en `main`.
- El merge de `dev` a `main` **solo se hace con autorización explícita del usuario**. Sin esa autorización, no hacer merge, rebase ni push a `main`.
