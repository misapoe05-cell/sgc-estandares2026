// views.js — Controlador de vistas
const Views = {

  async render() {
    // Ocultar todas las vistas
    document.querySelectorAll('.view').forEach(v => v.hidden = true);

    // Actualizar app bar
    this._updateAppbar();

    // Mostrar la actual
    const v = State.currentView;
    const target = document.getElementById('view' + v.charAt(0).toUpperCase() + v.slice(1));
    if (target) target.hidden = false;

    // FAB visible solo en home/guide-pdf
    const fab = document.getElementById('fabAddPdf');
    fab.classList.toggle('hidden', !(v === 'home' || (v === 'guide' && State.currentTab === 'pdf')));

    // Sincronizar bottom nav
    document.querySelectorAll('.bottom-nav button').forEach(b => {
      b.classList.toggle('active', b.dataset.nav === v);
    });

    // Render específico
    switch (v) {
      case 'home':     await this.renderHome();     break;
      case 'search':   await this.renderSearch();   break;
      case 'progress': await this.renderProgress(); break;
      case 'settings': /* estático */ break;
      case 'guide':    await this.renderGuide();    break;
      case 'map':      await this.renderMap();      break;
      case 'exam':     /* manejado por practice.js */ break;
    }

    // Scroll arriba al cambiar de vista
    if (target) target.scrollTop = 0;
    document.getElementById('main').scrollTop = 0;
  },

  _updateAppbar() {
    const v = State.currentView;
    const titles = {
      home: 'SGC Estándares',
      search: 'Búsqueda global',
      progress: 'Mi progreso',
      settings: 'Ajustes',
      map: 'Red de estándares',
      exam: 'Modo examen'
    };
    const back = document.getElementById('btnBack');
    const title = document.getElementById('appbarTitle');
    const actions = document.getElementById('appbarActions');
    actions.innerHTML = '';

    if (v === 'guide') {
      const m = State.findManifestEntry(State.currentGuide);
      title.textContent = m ? m.id : 'Guía';
      back.hidden = false;
      // Botón modo examen
      actions.innerHTML = `<button onclick="startExamForCurrent()" title="Modo examen">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
      </button>`;
    } else {
      title.textContent = titles[v] || 'SGC Estándares';
      back.hidden = true;
    }
  },

  async renderHome() {
    const filterChip = document.querySelector('.filter-chips .chip.active');
    const filter = filterChip ? filterChip.dataset.filter : 'all';
    const search = (document.getElementById('homeSearch').value || '').toLowerCase().trim();
    const list = document.getElementById('guideList');
    const pdfs = await DB.listPdfs();
    const pdfSet = new Set(pdfs.map(p => p.guideId));
    const progressList = await DB.listProgress();
    const progressByGuide = {};
    for (const p of progressList) {
      progressByGuide[p.guideId] = (progressByGuide[p.guideId] || 0) + 1;
    }

    let entries = State.manifest;
    if (filter !== 'all') entries = entries.filter(e => e.category === filter);
    if (search) {
      entries = entries.filter(e =>
        e.id.toLowerCase().includes(search) ||
        (e.title || '').toLowerCase().includes(search) ||
        (e.short_description || '').toLowerCase().includes(search)
      );
    }

    if (entries.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay guías que coincidan con tu búsqueda.</div>';
      return;
    }

    list.innerHTML = entries.map(e => {
      const hasPdf = pdfSet.has(e.slug);
      const readCount = progressByGuide[e.slug] || 0;
      const pct = Math.min(100, Math.round((readCount / e.parts_count) * 100));
      return `
        <div class="guide-card" onclick="openGuide('${e.slug}')">
          <div class="guide-card-header">
            <span class="guide-code">${e.id}</span>
            <span class="guide-cat ${e.category.toLowerCase()}">${e.category}</span>
          </div>
          <div class="guide-title">${e.title}</div>
          <div class="guide-meta">
            <span>${e.parts_count} partes</span>
            <span class="guide-badge ${hasPdf?'has-pdf':''}">${hasPdf ? '📄 PDF cargado' : '📄 Sin PDF'}</span>
          </div>
          ${pct > 0 ? `<div class="guide-progress"><div class="guide-progress-bar" style="width:${pct}%"></div></div>` : ''}
        </div>
      `;
    }).join('');
  },

  async renderSearch() {
    const q = (document.getElementById('globalSearch').value || '').trim().toLowerCase();
    const hint = document.getElementById('searchHint');
    const results = document.getElementById('searchResults');
    document.getElementById('searchClear').hidden = !q;

    if (q.length < 2) {
      hint.hidden = false;
      hint.textContent = 'Escribe al menos 2 letras para buscar.';
      results.innerHTML = '';
      return;
    }
    hint.hidden = true;

    // Cargar todas las guías si no están en caché
    const allGuides = [];
    for (const m of State.manifest) {
      const g = await State.loadGuide(m.slug);
      allGuides.push({ manifest: m, guide: g });
    }

    // Buscar
    const found = [];
    for (const { manifest: m, guide: g } of allGuides) {
      // Match en título o id => primer resultado
      if (m.id.toLowerCase().includes(q) || (m.title||'').toLowerCase().includes(q)) {
        found.push({ slug: m.slug, code: m.id, title: m.title, partIdx: null, snippet: m.title });
      }
      // Match dentro de cada parte
      g.parts.forEach((p, i) => {
        const text = (p.title + ' ' + p.blocks.map(b => extractText(b)).join(' ')).toLowerCase();
        if (text.includes(q)) {
          const snippet = makeSnippet(p.title + '. ' + p.blocks.map(b => extractText(b)).join(' '), q);
          found.push({
            slug: m.slug, code: m.id, title: p.title, partIdx: i, snippet
          });
        }
      });
    }

    if (found.length === 0) {
      results.innerHTML = '<div class="empty-state">Sin resultados.</div>';
      return;
    }

    // Limitar a 60 para no saturar
    results.innerHTML = found.slice(0, 60).map(r => `
      <div class="search-result" onclick="openGuide('${r.slug}', ${r.partIdx})">
        <div class="search-result-head">${r.code}${r.partIdx !== null ? ' · Parte ' + (r.partIdx+1) : ''}</div>
        <div class="search-result-title">${r.title}</div>
        <div class="search-result-snippet">${r.snippet}</div>
      </div>
    `).join('') + (found.length > 60 ? `<div class="empty-state">Y ${found.length-60} resultados más. Refina la búsqueda.</div>` : '');
  },

  async renderProgress() {
    const progress = await DB.listProgress();
    const bookmarks = await DB.listBookmarks();
    const notes = await DB.listNotes();

    document.getElementById('statRead').textContent = progress.length;
    document.getElementById('statBookmarks').textContent = bookmarks.length;
    document.getElementById('statNotes').textContent = notes.length;

    // Progreso por guía
    const byGuide = {};
    for (const p of progress) {
      byGuide[p.guideId] = (byGuide[p.guideId] || 0) + 1;
    }
    let html = '';
    for (const m of State.manifest) {
      const count = byGuide[m.slug] || 0;
      if (count === 0) continue;
      const pct = Math.round((count / m.parts_count) * 100);
      html += `
        <div class="guide-card" onclick="openGuide('${m.slug}')" style="margin:0 16px 8px">
          <div class="guide-card-header">
            <span class="guide-code">${m.id}</span>
            <span class="guide-cat">${count}/${m.parts_count} partes</span>
          </div>
          <div class="guide-title">${m.title}</div>
          <div class="guide-progress"><div class="guide-progress-bar" style="width:${pct}%"></div></div>
        </div>`;
    }
    if (!html) html = '<div class="empty-state">Aún no has marcado partes como leídas.</div>';
    document.getElementById('progressList').innerHTML = html;

    // Marcadores recientes
    let bmHtml = '';
    for (const b of bookmarks.slice(0, 10)) {
      const m = State.findManifestEntry(b.guideId);
      if (!m) continue;
      bmHtml += `
        <div class="bookmark-item">
          <div class="bm-text">
            <strong>${m.id} · Parte ${b.partIdx+1}</strong>
            ${b.partTitle}
          </div>
          <button onclick="openGuide('${b.guideId}', ${b.partIdx})">→</button>
          <button onclick="deleteBookmark(${b.id})" title="Borrar">×</button>
        </div>`;
    }
    if (!bmHtml) bmHtml = '<div class="empty-state">Aún no tienes marcadores.</div>';
    document.getElementById('bookmarksList').innerHTML = bmHtml;
  },

  async renderGuide() {
    const slug = State.currentGuide;
    const guide = await State.loadGuide(slug);
    const tab = State.currentTab;

    document.querySelectorAll('.guide-tabs button').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    const c = document.getElementById('guideTabContent');

    if (tab === 'study') {
      c.innerHTML = await Render.fullGuide(guide);
      // Si venimos de un resultado de búsqueda con partIdx
      if (State.currentPart != null && State.currentPart >= 0) {
        setTimeout(() => goToPart(State.currentPart), 100);
        State.currentPart = 0;
      }
    } else if (tab === 'pdf') {
      await PdfModule.render(slug, c);
    } else if (tab === 'practice') {
      await Practice.render(slug, c);
    } else if (tab === 'notes') {
      await this._renderNotes(slug, c);
    } else if (tab === 'bookmarks') {
      await this._renderBookmarks(slug, c);
    }
  },

  async _renderNotes(slug, container) {
    const text = await DB.getNote(slug);
    container.innerHTML = `
      <div class="notes-stage">
        <textarea class="note-input" id="noteInput" placeholder="Tus notas personales sobre esta guía. Se guardan automáticamente.">${escapeHtml(text)}</textarea>
        <div class="note-status" id="noteStatus"></div>
        <p class="notes-help">Estas notas son privadas y se guardan en tu dispositivo. Puedes exportarlas desde Ajustes.</p>
      </div>
    `;
    const input = document.getElementById('noteInput');
    const status = document.getElementById('noteStatus');
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      status.textContent = 'Guardando...';
      status.classList.remove('saved');
      timer = setTimeout(async () => {
        await DB.setNote(slug, input.value);
        status.textContent = '✓ Guardado';
        status.classList.add('saved');
      }, 600);
    });
  },

  async _renderBookmarks(slug, container) {
    const bms = await DB.listBookmarks(slug);
    if (bms.length === 0) {
      container.innerHTML = '<div class="empty-state">No tienes marcadores en esta guía.<br>Marca partes con la estrella ☆ mientras estudias.</div>';
      return;
    }
    container.innerHTML = '<div class="bookmark-list">' + bms.map(b => `
      <div class="bookmark-item">
        <div class="bm-text" onclick="openGuide('${slug}', ${b.partIdx})" style="cursor:pointer">
          <strong>Parte ${b.partIdx+1}</strong>
          ${b.partTitle}
        </div>
        <button onclick="deleteBookmark(${b.id})" title="Borrar">×</button>
      </div>
    `).join('') + '</div>';
  },

  async renderMap() {
    const container = document.getElementById('normMap');
    // Detectar referencias entre guías
    const refs = {}; // {slug: Set(of referenced ids)}
    for (const m of State.manifest) {
      const g = await State.loadGuide(m.slug);
      const text = JSON.stringify(g);
      const found = new Set();
      for (const m2 of State.manifest) {
        if (m2.slug === m.slug) continue;
        // Buscar el código corto (NMX-C-XXX)
        const baseCode = m2.id.replace(/-\d+$/, ''); // NMX-C-156-1 -> NMX-C-156
        if (text.includes(baseCode)) {
          found.add(m2.id);
        }
      }
      refs[m.slug] = found;
    }
    container.innerHTML = State.manifest.map(m => {
      const edges = refs[m.slug];
      return `
        <div class="norm-node" onclick="showNormConnections('${m.slug}')">
          <span class="norm-node-code">${m.id}</span>
          <span class="norm-node-title">${m.title}</span>
          <span class="norm-node-edges">${edges.size} ref</span>
        </div>
      `;
    }).join('');

    // Guardar para uso del modal
    State._normRefs = refs;
  }
};

// Helpers
function extractText(b) {
  if (!b) return '';
  if (b.type === 'p' || b.type === 'h2' || b.type === 'h3' || b.type === 'subtitle' || b.type === 'callout') return stripHtml(b.text || '');
  if (b.type === 'list') return (b.items || []).map(stripHtml).join(' ');
  if (b.type === 'table') return (b.rows || []).flat().map(stripHtml).join(' ');
  return '';
}
function stripHtml(s) { return (s || '').replace(/<[^>]+>/g,''); }
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function makeSnippet(text, q) {
  text = stripHtml(text);
  const lc = text.toLowerCase();
  const idx = lc.indexOf(q);
  if (idx < 0) return text.substring(0, 140) + '...';
  const start = Math.max(0, idx - 60);
  const end   = Math.min(text.length, idx + q.length + 100);
  let snip = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
  // Resaltar
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  snip = snip.replace(re, '<mark>$1</mark>');
  return snip;
}

// Globales para onclicks
async function openGuide(slug, partIdx = null) {
  const params = { guide: slug, tab: 'study' };
  if (partIdx !== null) params.part = partIdx;
  State.navigate('guide', params);
}

async function deleteBookmark(id) {
  await DB.deleteBookmark(id);
  State.toast('Marcador eliminado');
  Views.render();
}

async function showNormConnections(slug) {
  const m = State.findManifestEntry(slug);
  const refs = State._normRefs[slug];
  let body = `<p class="meta">Referencias dentro de <strong>${m.id}</strong></p>`;
  if (refs.size === 0) {
    body += '<p class="meta">Esta guía no menciona explícitamente otros estándares del catálogo.</p>';
  } else {
    body += '<div>';
    for (const refId of refs) {
      const refM = State.findManifestEntry(refId);
      if (!refM) continue;
      body += `
        <div class="modal-list-item" onclick="State.hideModal();openGuide('${refM.slug}')">
          <div class="mi-info">
            <div class="mi-code">${refM.id}</div>
            <div class="mi-title">${refM.title}</div>
          </div>
          <span style="color:var(--c-text-3)">→</span>
        </div>`;
    }
    body += '</div>';
  }
  body += `<button class="btn-block" style="margin-top:14px" onclick="State.hideModal();openGuide('${slug}')">Abrir ${m.id}</button>`;
  State.showModal(m.title, body);
}

// === Editar título de guía ===
async function openEditTitleModal(slug) {
  const guide = await State.loadGuide(slug);
  const m = guide.metadata;
  const manifestEntry = State.findManifestEntry(slug);
  const custom = await DB.getCustomTitle(slug);
  const isEdited = !!custom;
  // Código corto = el del manifest (NMX-C-083, NMX-C-156-1...)
  const shortCode = manifestEntry ? manifestEntry.id : '';

  const body = `
    <p class="meta">Edita los datos del estándar si fue actualizado (cambio de año, revisión, etc.).</p>
    <div class="edit-field">
      <label>Código corto (aparece en la lista y barra superior)</label>
      <input type="text" id="editShortCode" value="${escapeHtml(shortCode)}" placeholder="NMX-C-083">
    </div>
    <div class="edit-field">
      <label>Código completo del estándar</label>
      <input type="text" id="editCode" value="${escapeHtml(m.code || '')}" placeholder="NMX-C-XXX-ONNCCE-AAAA">
    </div>
    <div class="edit-field">
      <label>Título</label>
      <input type="text" id="editTitle" value="${escapeHtml(m.title || '')}" placeholder="Título del estándar">
    </div>
    <div class="edit-field">
      <label>Subtítulo (opcional)</label>
      <input type="text" id="editSubtitle" value="${escapeHtml(m.subtitle || '')}" placeholder="Guía NMX-C-XXX · Aprendizaje profundo">
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn-block" style="margin:0" onclick="saveCustomTitle('${slug}')">Guardar cambios</button>
    </div>
    ${isEdited ? `<button class="btn-block danger" style="margin-top:8px" onclick="resetCustomTitle('${slug}')">Restablecer al original</button>` : ''}
    <p class="meta" style="margin-top:10px;font-size:12px">Los cambios se guardan en este dispositivo. El contenido de la guía no cambia, solo el encabezado.</p>
  `;
  State.showModal('Editar encabezado', body);
}

async function saveCustomTitle(slug) {
  const shortCode = document.getElementById('editShortCode').value.trim();
  const code = document.getElementById('editCode').value.trim();
  const title = document.getElementById('editTitle').value.trim();
  const subtitle = document.getElementById('editSubtitle').value.trim();
  if (!title) {
    State.toast('El título no puede estar vacío');
    return;
  }
  if (!shortCode) {
    State.toast('El código corto no puede estar vacío');
    return;
  }
  await DB.setCustomTitle(slug, { shortCode, code, title, subtitle });
  // Limpiar caché y forzar recarga
  await State.reloadGuide(slug);
  await State.loadManifest();
  State.hideModal();
  State.toast('✓ Encabezado actualizado');
  Views.render();
}

async function resetCustomTitle(slug) {
  await DB.resetCustomTitle(slug);
  await State.reloadGuide(slug);
  await State.loadManifest();
  State.hideModal();
  State.toast('Encabezado restablecido');
  Views.render();
}
