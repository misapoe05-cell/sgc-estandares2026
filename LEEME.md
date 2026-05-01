# SGC Estándares — App Android para estudiar NMX-C

App offline para estudiar 13 estándares mexicanos (NMX-C) de Concreto y Geotecnia.
Las guías de aprendizaje están integradas en la app y los PDFs oficiales se cargan
manualmente para consulta dentro de la misma app.

---

## ✨ Características

- 📖 **13 guías de aprendizaje profundo** — fijas, no se pueden borrar
- 📄 **Carga manual de PDFs** — autodetecta a qué norma pertenece cada PDF
- 🎯 **Modo práctica** — flashcards con la sección de autoevaluación de cada guía
- 📝 **Modo examen** — preguntas aleatorias de las 13 guías con calificación
- 🗺️ **Red de normas** — ve qué normas se referencian entre sí
- ⭐ **Marcadores y notas** privadas por guía
- 📊 **Progreso de estudio** — qué partes has leído de cada guía
- 🔍 **Búsqueda global** — busca dentro del contenido de las 13 guías
- 🌙 **Modo oscuro / claro / auto**
- 🔤 **4 tamaños de fuente** ajustables
- 💾 **Exportar/importar** notas y marcadores como respaldo
- 📵 **100% offline** — todo funciona sin internet

---

## 🚀 Cómo obtener tu APK (sin instalar nada en tu PC)

Como acordamos, vamos a usar **GitHub Actions** para compilar la APK en la nube.
Es gratis. Solo necesitas una cuenta de GitHub.

### Paso 1 · Crear cuenta de GitHub (1 minuto)

Si no tienes cuenta: ve a https://github.com/signup y regístrate. Es gratis.

### Paso 2 · Crear un repositorio nuevo

1. Una vez dentro de GitHub, haz clic en el botón verde **"New"** (o ve a https://github.com/new).
2. Llena el formulario:
   - **Repository name:** `sgc-normas`
   - **Visibility:** *Private* (privado, solo tú lo ves) o *Public*, como prefieras.
   - **NO marques** "Add a README", "Add .gitignore" ni "Choose a license".
3. Clic en **"Create repository"**.

### Paso 3 · Subir los archivos del proyecto

GitHub te mostrará una página con instrucciones. Vamos a usar la opción más fácil:
**arrastrar y soltar** los archivos.

1. En esa misma página, busca el enlace **"uploading an existing file"** (en el texto
   "Get started by creating a new file or **uploading an existing file**"), o dirígete a:
   `https://github.com/TU_USUARIO/sgc-normas/upload/main`
2. **Descomprime** el ZIP `normas-app.zip` que te di en una carpeta de tu PC.
3. **Selecciona TODO el contenido** de esa carpeta (Ctrl+A) y arrástralo al navegador,
   sobre la zona "Drag files here to add them to your repository".
   - ⚠️ Importante: arrastra **el contenido** de la carpeta, no la carpeta misma.
4. Espera a que termine de subir todo (1-2 minutos).
5. Hasta abajo, en "Commit changes", deja todo por defecto y haz clic en
   **"Commit changes"**.

### Paso 4 · Esperar a que se compile la APK (5-8 minutos)

Apenas suban los archivos, GitHub Actions arrancará automáticamente.

1. Ve a la pestaña **"Actions"** de tu repositorio
   (`https://github.com/TU_USUARIO/sgc-normas/actions`).
2. Verás un workflow llamado **"Build Android APK"** corriendo (con un círculo
   amarillo girando).
3. Espera 5-8 minutos. Cuando termine bien aparecerá un check verde ✅.
4. Si por alguna razón falla (X roja), haz clic en el workflow y mira el log
   para ver qué pasó. Mándame una captura y lo resolvemos.

### Paso 5 · Descargar la APK

1. Cuando el workflow termine con check verde, haz clic en él.
2. En la parte de abajo de la página, en la sección **"Artifacts"**, verás
   un archivo llamado **"SGC-Normas-APK"**.
3. Haz clic para descargarlo. Se descarga como `.zip`.
4. Descomprímelo y dentro encontrarás **`SGC-Normas-v1.0.0.apk`**.

### Paso 6 · Instalar la APK en tu Android

1. Pasa el `.apk` a tu teléfono (Bluetooth, cable USB, Drive, correo, lo que sea).
2. En tu Android, abre el archivo.
3. Te aparecerá un mensaje "Por seguridad tu teléfono no instala apps de
   esta fuente". Es normal — la APK no está firmada para Play Store.
4. Toca **"Ajustes"** en ese mensaje y activa **"Permitir desde esta fuente"**
   (solo para esta vez).
5. Vuelve a abrir la APK y dale **"Instalar"**.
6. Listo, ya tienes la app en tu cajón de aplicaciones.

---

## 🔄 Para actualizar la app más adelante

Cuando quieras hacer cambios (agregar guías, cambiar diseño, etc.):

1. Modifica los archivos en GitHub (puedes editarlos directamente desde la web).
2. GitHub Actions compilará automáticamente una nueva APK.
3. Descárgala desde Actions y reinstálala en tu teléfono.

Para crear una **release oficial con versión** (que aparezca en la pestaña
"Releases" del repositorio):

1. En la página principal del repo, clic derecho en "Tags" → "Create new tag".
2. Pon `v1.0.1` (o la versión que toque) y publícalo.
3. La acción detecta el tag y crea una "Release" pública con la APK adjunta.

---

## 📁 Estructura del proyecto

```
normas-app/
├── www/                          ← La app web (HTML/CSS/JS)
│   ├── index.html
│   ├── assets/
│   │   ├── css/app.css
│   │   ├── js/                   ← Lógica de la app
│   │   │   ├── app.js, db.js, state.js, views.js
│   │   │   ├── render.js, pdf.js, practice.js
│   │   │   └── pdfjs/            ← Visor de PDF offline
│   │   └── data/                 ← Las 13 guías en JSON
│   │       ├── manifest.json
│   │       ├── c083.json, c109_1.json, ... (13 archivos)
├── android-resources/            ← Iconos de la app
│   ├── icon.svg
│   └── icon-48.png, icon-72.png, ...
├── scripts/
│   └── parse_guides.py           ← Genera los JSON desde los .docx
├── .github/workflows/
│   └── build-apk.yml             ← Configuración de compilación en la nube
├── package.json
├── capacitor.config.json
└── LEEME.md                      ← Este archivo
```

---

## 🛠️ Si quisieras compilar localmente (opcional)

No es necesario, pero si algún día quieres probarla en tu PC:

Requisitos: Node.js 20+, Android Studio con SDK, Java JDK 21.

```bash
npm install
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```

La APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📜 Notas técnicas

- **Stack:** Capacitor 6 + HTML/CSS/JS vanilla (sin frameworks pesados)
- **Almacenamiento:** IndexedDB (para notas, marcadores, progreso, PDFs)
- **Visor PDF:** PDF.js de Mozilla, embebido offline (~1.4 MB)
- **Tamaño estimado de la APK:** 8-12 MB
- **Mínimo Android:** 7.0 (API 24, ~98% de los dispositivos)
- **Sin permisos peligrosos:** la app solo pide acceso a archivos cuando
  el usuario toca "Cargar PDF". Nada se manda a servidores.
