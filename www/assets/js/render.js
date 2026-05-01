// render.js — convierte bloques estructurados a HTML
const Render = {

  block(b) {
    switch (b.type) {
      case 'h1': return '<!-- h1 manejado en partes -->';
      case 'h2': return `<h2>${b.text}</h2>`;
      case 'h3': return `<h3>${b.text}</h3>`;
      case 'p':  return `<p>${b.text}</p>`;
      case 'subtitle': return `<p class="subtitle">${b.text}</p>`;
      case 'callout': return `<div class="callout">${b.text}</div>`;
      case 'list':
        return '<ul>' + b.items.map(it => `<li>${it}</li>`).join('') + '</ul>';
      case 'table':
        if (!b.rows || b.rows.length === 0) return '';
        // Detectar si la primera fila es header (tiene <strong>)
        const first = b.rows[0];
        const looksHeader = first.every(c => /<strong>/.test(c));
        let html = '<div class="tbl-wrap"><table>';
        if (looksHeader) {
          html += '<thead><tr>' + first.map(c => `<th>${stripStrong(c)}</th>`).join('') + '</tr></thead>';
          html += '<tbody>' + b.rows.slice(1).map(r =>
            '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>'
          ).join('') + '</tbody>';
        } else {
          html += '<tbody>' + b.rows.map(r =>
            '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>'
          ).join('') + '</tbody>';
        }
        html += '</table></div>';
        return html;
      default:
        return '';
    }
  },

  blocks(arr) {
    return (arr || []).map(b => this.block(b)).join('');
  },

  async guideHeader(guide) {
    const m = guide.metadata;
    const customTitle = await DB.getCustomTitle(guide.slug);
    const isEdited = !!customTitle;
    return `
      <div class="guide-header">
        ${m.subtitle ? `<div class="gh-subtitle">${m.subtitle}</div>` : ''}
        ${m.kind ? `<div class="gh-kind">${m.kind}</div>` : ''}
        ${m.code ? `<div class="gh-code">${m.code}</div>` : ''}
        ${m.title ? `<div class="gh-title-row">
          <div class="gh-title">${m.title}</div>
          <button class="gh-edit-btn" onclick="openEditTitleModal('${guide.slug}')" aria-label="Editar título">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
        </div>` : ''}
        ${m.category ? `<div class="gh-cat">${m.category}${isEdited ? ' · <em style="color:var(--c-amber)">editado</em>' : ''}</div>` : ''}
        ${m.intro_callout ? `<div class="callout">${m.intro_callout}</div>` : ''}
      </div>
    `;
  },

  async guideTOC(guide) {
    const slug = guide.slug;
    let html = '<div class="guide-toc"><div class="guide-toc-head" onclick="toggleTOC(this)"><span>Índice</span><span>▾</span></div><div class="guide-toc-list">';
    for (let i = 0; i < guide.parts.length; i++) {
      const p = guide.parts[i];
      const read = await DB.isRead(slug, i);
      html += `<a href="#part-${i}" class="${read?'read':''}" onclick="goToPart(${i});return false;">
        <span class="idx">${i+1}.</span>
        <span>${p.title}</span>
      </a>`;
    }
    html += '</div></div>';
    return html;
  },

  async guidePart(guide, partIdx) {
    const p = guide.parts[partIdx];
    if (!p) return '';
    const slug = guide.slug;
    const read = await DB.isRead(slug, partIdx);
    const bm = await DB.findBookmark(slug, partIdx);
    return `
      <h1 id="part-${partIdx}">${p.title}</h1>
      <div class="part-actions">
        <button class="part-action ${read?'active':''}" onclick="togglePartRead(${partIdx})">
          ${read ? '✓ Leído' : 'Marcar leído'}
        </button>
        <button class="part-action ${bm?'active':''}" onclick="togglePartBookmark(${partIdx})">
          ${bm ? '⭐ Marcado' : '☆ Marcar'}
        </button>
      </div>
      ${this.blocks(p.blocks)}
    `;
  },

  async fullGuide(guide) {
    let html = '<div class="guide-content">';
    html += await this.guideHeader(guide);
    // Si hay bloques de intro antes de la primera parte, mostrarlos
    if (guide.intro_blocks && guide.intro_blocks.length) {
      html += this.blocks(guide.intro_blocks);
    }
    html += await this.guideTOC(guide);
    for (let i = 0; i < guide.parts.length; i++) {
      html += await this.guidePart(guide, i);
    }
    html += '</div>';
    return html;
  }
};

function stripStrong(html) {
  return html.replace(/<\/?strong>/g, '');
}

// Globales para onclick handlers
function toggleTOC(el) {
  el.parentElement.querySelector('.guide-toc-list').classList.toggle('open');
}

function goToPart(idx) {
  const target = document.getElementById('part-' + idx);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // cerrar TOC
  document.querySelectorAll('.guide-toc-list.open').forEach(el => el.classList.remove('open'));
}

async function togglePartRead(idx) {
  const slug = State.currentGuide;
  const isRead = await DB.isRead(slug, idx);
  await DB.markRead(slug, idx, !isRead);
  State.toast(isRead ? 'Marcado como no leído' : '✓ Parte completada');
  // Refrescar solo el botón en lugar de todo
  const guide = State.guidesCache[slug];
  const part = guide.parts[idx];
  const partEl = document.getElementById('part-' + idx);
  if (partEl) {
    const actions = partEl.parentElement.querySelector(`#part-${idx} + .part-actions`) || partEl.nextElementSibling;
    if (actions && actions.classList.contains('part-actions')) {
      actions.children[0].outerHTML = `<button class="part-action ${!isRead?'active':''}" onclick="togglePartRead(${idx})">${!isRead ? '✓ Leído' : 'Marcar leído'}</button>`;
    }
  }
  // refrescar también TOC si está abierta
  const tocLink = document.querySelector(`.guide-toc-list a[href="#part-${idx}"]`);
  if (tocLink) tocLink.classList.toggle('read', !isRead);
}

async function togglePartBookmark(idx) {
  const slug = State.currentGuide;
  const guide = State.guidesCache[slug];
  const part = guide.parts[idx];
  const existing = await DB.findBookmark(slug, idx);
  if (existing) {
    await DB.deleteBookmark(existing.id);
    State.toast('Marcador eliminado');
  } else {
    await DB.addBookmark(slug, idx, part.title, '');
    State.toast('⭐ Marcador guardado');
  }
  // refresh button
  const newBm = await DB.findBookmark(slug, idx);
  const partEl = document.getElementById('part-' + idx);
  if (partEl) {
    const actions = partEl.nextElementSibling;
    if (actions && actions.classList.contains('part-actions')) {
      actions.children[1].outerHTML = `<button class="part-action ${newBm?'active':''}" onclick="togglePartBookmark(${idx})">${newBm ? '⭐ Marcado' : '☆ Marcar'}</button>`;
    }
  }
}
