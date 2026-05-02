// pdf.js — Carga manual de PDFs + abrir con app externa del sistema
const PdfModule = {

  async render(slug, container) {
    const stored = await DB.getPdf(slug);
    const m = State.findManifestEntry(slug);

    if (!stored) {
      container.innerHTML = `
        <div class="pdf-empty">
          <div class="empty-icon">📄</div>
          <h3>No tienes el PDF de ${m.id}</h3>
          <p>Carga el PDF oficial del estándar desde tu dispositivo. Se guardará localmente para abrirlo cuando quieras con tu visor de PDF preferido.</p>
          <button onclick="loadPdfForCurrent()">Cargar PDF</button>
        </div>
      `;
      return;
    }

    // Mostrar info del PDF guardado + botones para abrir/reemplazar
    const sizeKB = Math.round(stored.size / 1024);
    const sizeMB = sizeKB > 1024 ? (sizeKB/1024).toFixed(2) + ' MB' : sizeKB + ' KB';
    const date = new Date(stored.savedAt).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });

    container.innerHTML = `
      <div class="pdf-saved">
        <div class="pdf-icon-big">📄</div>
        <h3>${m.id}</h3>
        <p class="pdf-filename">${escapeHtml(stored.name || 'documento.pdf')}</p>
        <div class="pdf-meta-row">
          <span>${sizeMB}</span>
          <span>·</span>
          <span>Guardado el ${date}</span>
        </div>
        <button class="pdf-open-btn" onclick="openPdfExternal('${slug}')">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Abrir con visor de PDF
        </button>
        <p class="pdf-help">Se abrirá con la aplicación de PDF que prefieras (Drive, Adobe, etc.). Android te dejará elegir la primera vez.</p>
        <div class="pdf-actions-row">
          <button class="pdf-action-secondary" onclick="loadPdfForCurrent()">Reemplazar</button>
          <button class="pdf-action-secondary danger" onclick="deletePdfForCurrent('${slug}')">Eliminar</button>
        </div>
      </div>
    `;
  },

  // Detectar a qué guía pertenece un PDF por su nombre
  detectGuide(filename) {
    const lc = filename.toLowerCase();
    for (const m of State.manifest) {
      const baseId = m.id.toLowerCase();
      const parts = m.id.replace('NMX-C-', '').toLowerCase();
      const partsAlt = parts.replace('-', '_');
      const partsNoDash = parts.replace('-', '');
      const baseNum = parts.split('-')[0];

      if (lc.includes(baseId) ||
          lc.includes(baseId.replace(/-/g, '_')) ||
          lc.includes('nmx-c-' + parts) ||
          lc.includes('nmx_c_' + partsAlt) ||
          lc.includes('nmxc' + partsNoDash) ||
          lc.includes('-c-' + parts) ||
          (lc.includes('c-' + baseNum) || lc.includes('c_' + baseNum) || lc.includes('c' + baseNum))) {
        return m.slug;
      }
    }
    return null;
  }
};

// Abrir PDF con app externa del sistema
async function openPdfExternal(slug) {
  const stored = await DB.getPdf(slug);
  if (!stored) {
    State.toast('No hay PDF guardado');
    return;
  }
  try {
    const blob = new Blob([stored.buffer], { type: 'application/pdf' });

    // En Capacitor (Android nativo), guardar a Filesystem y abrir con FileOpener
    const isCap = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    if (isCap) {
      try {
        const base64 = await blobToBase64(blob);
        // Sanear nombre del archivo
        const safeName = (stored.name || `${slug}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');

        const Filesystem = window.Capacitor.Plugins.Filesystem;
        const FileOpener = window.Capacitor.Plugins.FileOpener;

        if (Filesystem && FileOpener) {
          // Guardar al directorio de cache (no necesita permisos)
          await Filesystem.writeFile({
            path: safeName,
            data: base64,
            directory: 'CACHE'
          });
          // Obtener URI absoluto
          const uriResult = await Filesystem.getUri({
            path: safeName,
            directory: 'CACHE'
          });
          // Abrir con app externa - esto dispara el chooser de Android
          await FileOpener.open({
            filePath: uriResult.uri,
            contentType: 'application/pdf'
          });
          return;
        } else if (Filesystem) {
          // Sin FileOpener, intentar con App.openUrl
          await Filesystem.writeFile({
            path: safeName, data: base64, directory: 'CACHE'
          });
          const uriResult = await Filesystem.getUri({
            path: safeName, directory: 'CACHE'
          });
          if (window.Capacitor.Plugins.App && window.Capacitor.Plugins.App.openUrl) {
            await window.Capacitor.Plugins.App.openUrl({ url: uriResult.uri });
            return;
          }
        }
      } catch (capErr) {
        console.warn('Capacitor open failed:', capErr);
        State.toast('No pude abrir el PDF: ' + (capErr.message || 'error desconocido'));
      }
    }

    // Fallback web: blob URL en window.open
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    if (!opened) {
      const a = document.createElement('a');
      a.href = url;
      a.download = stored.name || `${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    State.toast('Error al abrir: ' + e.message);
    console.error(e);
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      // result es "data:application/pdf;base64,XXXX"; quitamos el prefijo
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function deletePdfForCurrent(slug) {
  if (!confirm('¿Eliminar el PDF guardado de esta guía?')) return;
  await DB.deletePdf(slug);
  State.toast('PDF eliminado');
  Views.render();
}

// Carga manual desde el botón
async function loadPdfForCurrent() {
  State._pdfReplaceTarget = State.currentGuide;
  document.getElementById('pdfFileInput').click();
}

async function handlePdfUpload(file) {
  if (!file) return;
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    State.toast('Solo se aceptan archivos PDF');
    return;
  }

  let targetSlug = State._pdfReplaceTarget;
  State._pdfReplaceTarget = null;

  if (!targetSlug) {
    // Autodetectar por nombre
    const detected = PdfModule.detectGuide(file.name);
    if (detected) {
      const m = State.findManifestEntry(detected);
      if (confirm(`Detecté que este PDF corresponde a ${m.id}. ¿Asociar?`)) {
        targetSlug = detected;
      }
    }
    if (!targetSlug) {
      let body = '<p class="meta">No detecté automáticamente el estándar. Selecciona a cuál asociar este PDF:</p>';
      body += State.manifest.map(m => `
        <div class="modal-list-item" onclick="confirmPdfAssoc('${m.slug}')">
          <div class="mi-info">
            <div class="mi-code">${m.id}</div>
            <div class="mi-title">${m.title}</div>
          </div>
          <span style="color:var(--c-text-3)">→</span>
        </div>
      `).join('');
      State._pendingPdfFile = file;
      State.showModal('Asociar PDF a estándar', body);
      return;
    }
  }

  await DB.savePdf(targetSlug, file, file.name);
  State.toast(`📄 PDF guardado en ${State.findManifestEntry(targetSlug).id}`);
  if (State.currentView === 'guide' && State.currentGuide === targetSlug) {
    State.currentTab = 'pdf';
    Views.render();
  } else {
    Views.render();
  }
}

async function confirmPdfAssoc(slug) {
  const file = State._pendingPdfFile;
  State._pendingPdfFile = null;
  State.hideModal();
  if (!file) return;
  await DB.savePdf(slug, file, file.name);
  State.toast(`📄 PDF guardado en ${State.findManifestEntry(slug).id}`);
  Views.render();
}
