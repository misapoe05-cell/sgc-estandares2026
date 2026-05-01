// pdf.js — Visor de PDFs (PDF.js) + carga manual con autodetección
const PdfModule = {
  pdfDoc: null,
  pageNum: 1,
  scale: 1.2,
  rendering: false,
  pendingPage: null,

  async render(slug, container) {
    const stored = await DB.getPdf(slug);
    const m = State.findManifestEntry(slug);

    if (!stored) {
      container.innerHTML = `
        <div class="pdf-empty">
          <div class="empty-icon">📄</div>
          <h3>No tienes el PDF de ${m.id}</h3>
          <p>Carga el PDF oficial de la norma desde tu dispositivo. Se guardará localmente para consulta offline.</p>
          <button onclick="loadPdfForCurrent()">Cargar PDF</button>
        </div>
      `;
      return;
    }

    // Mostrar visor
    container.innerHTML = `
      <div class="pdf-viewer">
        <div class="pdf-toolbar">
          <button id="pdfPrev">‹</button>
          <span class="pdf-page-info" id="pdfPageInfo">— / —</span>
          <button id="pdfNext">›</button>
          <button id="pdfZoomOut">−</button>
          <button id="pdfZoomIn">+</button>
          <button id="pdfReplace" title="Reemplazar">↺</button>
          <button id="pdfDelete" title="Eliminar">🗑</button>
        </div>
        <div class="pdf-canvas-wrap">
          <canvas id="pdfCanvas"></canvas>
        </div>
      </div>
    `;

    // Asegurar PDF.js cargado
    await this._ensurePdfJs();

    // Cargar el documento
    const data = new Uint8Array(stored.buffer);
    this.pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    this.pageNum = 1;
    this.scale = 1.2;
    await this._renderPage(this.pageNum);

    document.getElementById('pdfPrev').onclick = () => this._prev();
    document.getElementById('pdfNext').onclick = () => this._next();
    document.getElementById('pdfZoomIn').onclick = () => { this.scale = Math.min(3, this.scale * 1.2); this._renderPage(this.pageNum); };
    document.getElementById('pdfZoomOut').onclick = () => { this.scale = Math.max(0.6, this.scale / 1.2); this._renderPage(this.pageNum); };
    document.getElementById('pdfReplace').onclick = () => { State._pdfReplaceTarget = slug; document.getElementById('pdfFileInput').click(); };
    document.getElementById('pdfDelete').onclick = async () => {
      if (confirm('¿Eliminar el PDF cargado?')) {
        await DB.deletePdf(slug);
        State.toast('PDF eliminado');
        Views.render();
      }
    };
  },

  async _ensurePdfJs() {
    if (window.pdfjsLib) return;
    await loadScript('assets/js/pdfjs/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/js/pdfjs/pdf.worker.min.js';
  },

  async _renderPage(num) {
    if (this.rendering) { this.pendingPage = num; return; }
    this.rendering = true;
    const page = await this.pdfDoc.getPage(num);
    const canvas = document.getElementById('pdfCanvas');
    if (!canvas) { this.rendering = false; return; }
    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: this.scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: ctx, viewport }).promise;
    this.rendering = false;
    document.getElementById('pdfPageInfo').textContent = `${num} / ${this.pdfDoc.numPages}`;
    if (this.pendingPage !== null) {
      const p = this.pendingPage; this.pendingPage = null;
      this._renderPage(p);
    }
  },

  _prev() { if (this.pageNum > 1) { this.pageNum--; this._renderPage(this.pageNum); } },
  _next() { if (this.pageNum < this.pdfDoc.numPages) { this.pageNum++; this._renderPage(this.pageNum); } },

  // Detectar a qué guía pertenece un PDF por su nombre
  detectGuide(filename) {
    const lc = filename.toLowerCase();
    // Patrones: "nmx-c-435", "nmx_c_435", "NMXC435", "C435", "c-435-1"
    for (const m of State.manifest) {
      const baseId = m.id.toLowerCase();          // "nmx-c-435-1"
      const parts = m.id.replace('NMX-C-', '').toLowerCase(); // "435-1"
      const partsAlt = parts.replace('-', '_');   // "435_1"
      const partsNoDash = parts.replace('-', ''); // "4351"
      const baseNum = parts.split('-')[0];        // "435"

      if (lc.includes(baseId) ||
          lc.includes(baseId.replace(/-/g, '_')) ||
          lc.includes('nmx-c-' + parts) ||
          lc.includes('nmx_c_' + partsAlt) ||
          lc.includes('nmxc' + partsNoDash) ||
          lc.includes('-c-' + parts) ||
          // Si es la única coincidencia con el número base
          (lc.includes('c-' + baseNum) || lc.includes('c_' + baseNum) || lc.includes('c' + baseNum))) {
        return m.slug;
      }
    }
    return null;
  }
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

// Globales
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

  // Si tenemos un target explícito (botón "Cargar PDF" o "Reemplazar")
  let targetSlug = State._pdfReplaceTarget;
  State._pdfReplaceTarget = null;

  if (!targetSlug) {
    // Autodetectar por nombre
    const detected = PdfModule.detectGuide(file.name);
    if (detected) {
      // Pedir confirmación
      const m = State.findManifestEntry(detected);
      if (confirm(`Detecté que este PDF corresponde a ${m.id}. ¿Asociar?`)) {
        targetSlug = detected;
      }
    }
    if (!targetSlug) {
      // Mostrar lista para elegir
      let body = '<p class="meta">No detecté automáticamente la norma. Selecciona a cuál asociar este PDF:</p>';
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
      State.showModal('Asociar PDF a norma', body);
      return;
    }
  }

  await PdfModule._ensurePdfJs();
  await DB.savePdf(targetSlug, file, file.name);
  State.toast(`📄 PDF guardado en ${State.findManifestEntry(targetSlug).id}`);
  // Si estamos en la guía correspondiente, refrescar
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
