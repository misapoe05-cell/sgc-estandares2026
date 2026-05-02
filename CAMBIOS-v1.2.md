# Actualización v1.2 — Cambios

## ¿Qué hay de nuevo?

1. **Nombre de la app: "SGC Estándares"** (antes "SGC Normas")
2. **Tab "Estándar"** dentro de cada guía (antes "Norma")
3. **PDFs ahora se abren con la app del sistema** (Drive, Adobe, Foxit, etc.)
   en lugar del visor interno. Más rápido y aprovecha tus apps preferidas.
4. **Editar código corto** del estándar también desde el lápiz ✏️
   (antes solo se podía editar el código completo)
5. **Orden de los estándares en el Home** según el listado de ONNCCE:
   - Concreto: 161, 156, 435, 159, 148, 109, 083
   - Geotecnia: 431, 467, 468, 475, 476, 511

## Archivos que cambiaron

```
www/index.html                       (tabs y nombre)
www/assets/css/app.css               (estilos de PDF guardado)
www/assets/js/db.js                  (no cambia, mismo schema)
www/assets/js/state.js               (shortCode + recargar)
www/assets/js/render.js              (sin cambios)
www/assets/js/views.js               (modal con shortCode)
www/assets/js/pdf.js                 (REESCRITO: abre con app externa)
www/assets/data/manifest.json        (orden ONNCCE + 511 a Geotecnia)
scripts/parse_guides.py              (orden + categorías)
.github/workflows/build-apk.yml      (app_name = "SGC Estándares")
package.json                         (+ @capacitor-community/file-opener)
capacitor.config.json                (appName actualizado)
LEEME.md                             (textos actualizados)
```

Notar que el directorio `www/assets/js/pdfjs/` (que contenía el visor interno
PDF.js de 1.4 MB) ya NO se necesita y puede eliminarse del repo, aunque
no causa problemas si se queda.

## Cómo aplicar

1. Sube los archivos al repo de GitHub (arrastrando, igual que antes).
2. Espera 2-3 min a que GitHub Actions compile la APK nueva.
3. Descarga la APK del Artifacts e instálala en tu Android.
4. Tus notas, marcadores y PDFs cargados se conservan.
