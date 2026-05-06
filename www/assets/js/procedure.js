// procedure.js — Carga y apertura de procedimientos internos (PDF/Word/Excel)
const ProcModule = {

  // Mapeo de extensiones a mime types y etiquetas
  TYPES: {
    'pdf':  { label: 'PDF',   icon: '📄', mime: 'application/pdf' },
    'doc':  { label: 'Word',  icon: '📝', mime: 'application/msword' },
    'docx': { label: 'Word',  icon: '📝', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    'xls':  { label: 'Excel', icon: '📊', mime: 'application/vnd.ms-excel' },
    'xlsx': { label: 'Excel', icon: '📊', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  },

  detectType(filename) {
    const ext = (filename || '').toLowerCase().split('.').pop();
    return this.TYPES[ext] || { label: 'Documento', icon: '📎', mime: 'application/octet-stream' };
  },

  async render(slug, container) {
    const stored = await DB.getProcedure(slug);
    const m = State.findManifestEntry(slug);

    if (!stored) {
      container.innerHTML = `
        <div class="pdf-empty">
          <div class="empty-icon">📋</div>
          <h3>Procedimiento interno</h3>
          <p>Carga aquí el procedimiento de tu laboratorio o lugar de trabajo correspondiente a ${m.id}. Acepta PDF, Word (.doc/.docx) y Excel (.xls/.xlsx).</p>
          <button onclick="loadProcedureForCurrent()">Cargar procedimiento</button>
          <p class="pdf-help" style="margin-top:18px">Útil para tener junto al estándar oficial el procedimiento específico de tu empresa, formatos de captura y registros internos.</p>
        </div>
      `;
      return;
    }

    // Mostrar info del procedimiento guardado
    const ext = (stored.name || '').toLowerCase().split('.').pop();
    const typeInfo = this.detectType(stored.name);
    const sizeKB = Math.round(stored.size / 1024);
    const sizeMB = sizeKB > 1024 ? (sizeKB/1024).toFixed(2) + ' MB' : sizeKB + ' KB';
    const date = new Date(stored.savedAt).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });

    container.innerHTML = `
      <div class="pdf-saved">
        <div class="pdf-icon-big">${typeInfo.icon}</div>
        <h3>${m.id}</h3>
        <p class="proc-type-tag">PROCEDIMIENTO · ${typeInfo.label.toUpperCase()}</p>
        <p class="pdf-filename">${escapeHtml(stored.name || 'documento')}</p>
        <div class="pdf-meta-row">
          <span>${sizeMB}</span>
          <span>·</span>
          <span>Guardado el ${date}</span>
        </div>
        <button class="pdf-open-btn" onclick="openProcedureExternal('${slug}')">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Abrir con ${typeInfo.label === 'PDF' ? 'visor de PDF' : (typeInfo.label === 'Word' ? 'visor de Word' : 'visor de Excel')}
        </button>
        <p class="pdf-help">Se abrirá con la aplicación que prefieras (Drive, Office, WPS, etc.). Android te dejará elegir la primera vez.</p>
        <div class="pdf-actions-row">
          <button class="pdf-action-secondary" onclick="loadProcedureForCurrent()">Reemplazar</button>
          <button class="pdf-action-secondary danger" onclick="deleteProcedureForCurrent('${slug}')">Eliminar</button>
        </div>
      </div>
    `;
  }
};

// === Cargar procedimiento ===
async function loadProcedureForCurrent() {
  State._procReplaceTarget = State.currentGuide;
  document.getElementById('procFileInput').click();
}

async function handleProcUpload(file) {
  if (!file) return;

  const ext = (file.name || '').toLowerCase().split('.').pop();
  const valid = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
  if (!valid.includes(ext)) {
    State.toast('Solo se aceptan PDF, Word o Excel');
    return;
  }

  const targetSlug = State._procReplaceTarget || State.currentGuide;
  State._procReplaceTarget = null;

  if (!targetSlug) {
    State.toast('No hay guía seleccionada');
    return;
  }

  const typeInfo = ProcModule.detectType(file.name);
  await DB.saveProcedure(targetSlug, file, file.name, typeInfo.mime);

  const m = State.findManifestEntry(targetSlug);
  State.toast(`📋 Procedimiento (${typeInfo.label}) guardado en ${m.id}`);

  if (State.currentView === 'guide' && State.currentGuide === targetSlug) {
    State.currentTab = 'proc';
    Views.render();
  } else {
    Views.render();
  }
}

async function deleteProcedureForCurrent(slug) {
  if (!confirm('¿Eliminar el procedimiento guardado de esta guía?')) return;
  await DB.deleteProcedure(slug);
  State.toast('Procedimiento eliminado');
  Views.render();
}

// === Abrir procedimiento con app externa ===
async function openProcedureExternal(slug) {
  const stored = await DB.getProcedure(slug);
  if (!stored) {
    State.toast('No hay procedimiento guardado');
    return;
  }
  try {
    const blob = new Blob([stored.buffer], { type: stored.mimeType || 'application/octet-stream' });
    const isCap = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

    if (isCap) {
      try {
        const base64 = await blobToBase64(blob);
        const safeName = (stored.name || `${slug}-procedimiento`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const Filesystem = window.Capacitor.Plugins.Filesystem;
        const FileOpener = window.Capacitor.Plugins.FileOpener;

        if (Filesystem && FileOpener) {
          await Filesystem.writeFile({
            path: safeName, data: base64, directory: 'CACHE'
          });
          const uriResult = await Filesystem.getUri({
            path: safeName, directory: 'CACHE'
          });
          await FileOpener.open({
            filePath: uriResult.uri,
            contentType: stored.mimeType || 'application/octet-stream'
          });
          return;
        } else if (Filesystem) {
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
        State.toast('No pude abrir: ' + (capErr.message || 'error'));
      }
    }

    // Fallback web
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    if (!opened) {
      const a = document.createElement('a');
      a.href = url;
      a.download = stored.name || `${slug}-procedimiento`;
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
