# Actualización v1.3 — Pestaña "Procedimiento" + cambios v1.2

## ¿Qué hay de nuevo en esta versión?

**🆕 Pestaña "Procedimiento" (5º lugar)** — Junto al Estándar, ahora puedes
cargar el procedimiento interno de tu lugar de trabajo:
- Acepta **PDF, Word (.doc/.docx) y Excel (.xls/.xlsx)**
- Uno por guía (al cargar uno nuevo reemplaza el anterior)
- Se guarda localmente y se abre con la app que prefieras
- Detecta el tipo de archivo y muestra el icono adecuado (📄 PDF, 📝 Word, 📊 Excel)
- En el Home, las tarjetas ahora muestran 2 badges:
  - 📄 Estándar (verde) - si tienes el PDF oficial cargado
  - 📋 Procedimiento (amber) - si tienes el procedimiento interno cargado
  - "Sin documentos" si no tienes ninguno

**Plus, todos los cambios de v1.2 que ya tenías pendientes:**
- Nombre app: "SGC Estándares"
- PDFs se abren con app externa (no visor interno)
- Editar código corto del estándar
- Orden ONNCCE de las guías
- 511-1 reclasificada como Geotecnia

## Archivos nuevos/modificados

```
www/index.html                     (tab Procedimiento + input file extra)
www/assets/css/app.css             (estilos badge has-proc + proc-type-tag)
www/assets/js/db.js                (store procedures + version 3)
www/assets/js/state.js             (sin cambios)
www/assets/js/render.js            (sin cambios)
www/assets/js/views.js             (badges del home + handler tab proc)
www/assets/js/pdf.js               (de v1.2)
www/assets/js/procedure.js         (NUEVO archivo)
www/assets/js/app.js               (handler procFileInput + export con titles)
www/assets/data/manifest.json      (orden ONNCCE)
scripts/parse_guides.py            (categorías + orden)
.github/workflows/build-apk.yml    (app_name = SGC Estándares)
package.json                       (+ file-opener)
capacitor.config.json              (appName)
LEEME.md                           (textos actualizados)
```

⚠️ **Importante:** Como agregué un nuevo archivo (`procedure.js`), asegúrate
de subirlo. Y como modifiqué muchos otros, si subes la carpeta `www`
completa todo se actualiza correctamente.

## Cómo aplicar

1. Sube los archivos al repo de GitHub (arrastrando, igual que antes).
2. Espera 3-4 min a que GitHub Actions compile la APK.
3. Descarga la APK del Artifacts e instálala en tu Android.
4. Tus notas, marcadores, PDFs y títulos editados se conservan.
5. Tu base de datos local se migra automáticamente para incluir
   el nuevo "almacén" de procedimientos.
