# 3dDtr3s

## Aplicación web

La aplicación publicada está en la raíz del repositorio.

- Entrada: `index.html`
- Catálogo: `assets/catalog-data.js`
- Estilos: `style.css`
- Recursos multimedia: `assets/`

Dentro de `assets/`, las carpetas `catalog-user-*`, `upscaled`, `fonts`, `vendor` y las carpetas de servicios mantienen sus nombres porque esas rutas son utilizadas por la página. Los originales que no usa el sitio están agrupados en `assets/_sources/`.

## Publicación en Vercel

Configura el proyecto con estos valores:

- **Root Directory:** dejar vacío o usar la raíz del repositorio
- **Framework Preset:** `Other`
- **Build Command:** dejar vacío
- **Output Directory:** dejar vacío
- **Install Command:** dejar vacío para la versión estática

El archivo `.env` es local y no debe subirse. Si se usa el chatbot, configura `GEMINI_API_KEY` como variable de entorno en Vercel usando `.env.example` como referencia.

## Publicación en GitHub

Sube el contenido de esta raíz conservando especialmente la carpeta `assets/`. No reemplaces las rutas del catálogo por rutas externas.
