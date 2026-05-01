// state.js — Estado global y router simple
const State = {
  manifest: [],            // lista de guías
  guidesCache: {},         // {slug: data}
  currentView: 'home',
  currentGuide: null,
  currentPart: 0,
  currentTab: 'study',
  history: [],             // pila para back

  async loadManifest() {
    const res = await fetch('assets/data/manifest.json');
    this.manifest = await res.json();
    // Aplicar títulos personalizados si existen
    const customs = await DB.listCustomTitles();
    const byId = {};
    for (const c of customs) byId[c.guideId] = c;
    for (const m of this.manifest) {
      const c = byId[m.slug];
      if (c) {
        if (c.title)    m.title    = c.title;
        if (c.code)     m.id       = c.code;
        if (c.subtitle) m.subtitle = c.subtitle;
      }
    }
    return this.manifest;
  },

  async loadGuide(slug) {
    if (this.guidesCache[slug]) return this.guidesCache[slug];
    const res = await fetch(`assets/data/${slug}.json`);
    const data = await res.json();
    // Aplicar título personalizado si existe
    const c = await DB.getCustomTitle(slug);
    if (c) {
      if (c.title)    data.metadata.title    = c.title;
      if (c.code)     data.metadata.code     = c.code;
      if (c.subtitle) data.metadata.subtitle = c.subtitle;
    }
    this.guidesCache[slug] = data;
    return data;
  },

  // Volver a cargar una guía desde disco (saltarse caché)
  async reloadGuide(slug) {
    delete this.guidesCache[slug];
    return this.loadGuide(slug);
  },

  findManifestEntry(idOrSlug) {
    return this.manifest.find(e => e.id === idOrSlug || e.slug === idOrSlug);
  },

  navigate(view, params = {}) {
    if (this.currentView !== view || JSON.stringify(params) !== JSON.stringify(this._lastParams)) {
      this.history.push({
        view: this.currentView,
        guide: this.currentGuide,
        part: this.currentPart,
        tab: this.currentTab
      });
    }
    this.currentView = view;
    if (params.guide) this.currentGuide = params.guide;
    if (params.tab !== undefined) this.currentTab = params.tab;
    if (params.part !== undefined) this.currentPart = params.part;
    this._lastParams = { ...params };
    Views.render();
  },

  back() {
    if (this.history.length === 0) {
      this.navigate('home');
      return false;
    }
    const prev = this.history.pop();
    this.currentView = prev.view;
    this.currentGuide = prev.guide;
    this.currentPart = prev.part;
    this.currentTab = prev.tab;
    Views.render();
    return true;
  },

  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  },

  showModal(title, bodyHtml, onClick = null) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').hidden = false;
    if (onClick) {
      document.getElementById('modalBody').onclick = onClick;
    }
  },

  hideModal() {
    document.getElementById('modalOverlay').hidden = true;
    document.getElementById('modalBody').onclick = null;
  }
};
