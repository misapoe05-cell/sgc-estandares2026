// db.js — Storage offline persistente
// Stores: notes (por guía), bookmarks, progress, pdfs (blobs), settings
const DB = (() => {
  const NAME = 'sgc_normas_db';
  const VERSION = 2;
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('notes'))      db.createObjectStore('notes',     { keyPath: 'guideId' });
        if (!db.objectStoreNames.contains('bookmarks'))  db.createObjectStore('bookmarks', { keyPath: 'id', autoIncrement: true });
        if (!db.objectStoreNames.contains('progress'))   db.createObjectStore('progress',  { keyPath: 'key' }); // key = `${guideId}:${partIdx}`
        if (!db.objectStoreNames.contains('pdfs'))       db.createObjectStore('pdfs',      { keyPath: 'guideId' });
        if (!db.objectStoreNames.contains('settings'))   db.createObjectStore('settings',  { keyPath: 'key' });
        if (!db.objectStoreNames.contains('titles'))     db.createObjectStore('titles',    { keyPath: 'guideId' });
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
    });
  }

  async function _tx(store, mode = 'readonly') {
    const db = await open();
    return db.transaction(store, mode).objectStore(store);
  }

  return {
    async get(store, key) {
      const s = await _tx(store);
      return new Promise((res, rej) => {
        const r = s.get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    },
    async put(store, value) {
      const s = await _tx(store, 'readwrite');
      return new Promise((res, rej) => {
        const r = s.put(value); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    },
    async delete(store, key) {
      const s = await _tx(store, 'readwrite');
      return new Promise((res, rej) => {
        const r = s.delete(key); r.onsuccess = () => res(); r.onerror = () => rej(r.error);
      });
    },
    async getAll(store) {
      const s = await _tx(store);
      return new Promise((res, rej) => {
        const r = s.getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
      });
    },
    async clear(store) {
      const s = await _tx(store, 'readwrite');
      return new Promise((res, rej) => {
        const r = s.clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error);
      });
    },
    async clearAll() {
      for (const s of ['notes','bookmarks','progress','pdfs','settings','titles']) {
        await this.clear(s);
      }
    },

    // Helpers de alto nivel
    async getSetting(key, def = null) {
      const r = await this.get('settings', key);
      return r ? r.value : def;
    },
    async setSetting(key, value) {
      return this.put('settings', { key, value });
    },
    async getNote(guideId) {
      const r = await this.get('notes', guideId);
      return r ? r.text : '';
    },
    async setNote(guideId, text) {
      return this.put('notes', { guideId, text, updatedAt: Date.now() });
    },
    async listNotes() {
      const all = await this.getAll('notes');
      return all.filter(n => n.text && n.text.trim().length > 0);
    },
    async markRead(guideId, partIdx, read = true) {
      const key = `${guideId}:${partIdx}`;
      if (read) await this.put('progress', { key, guideId, partIdx, ts: Date.now() });
      else      await this.delete('progress', key);
    },
    async isRead(guideId, partIdx) {
      const r = await this.get('progress', `${guideId}:${partIdx}`);
      return !!r;
    },
    async listProgress() {
      return this.getAll('progress');
    },
    async addBookmark(guideId, partIdx, partTitle, snippet) {
      return this.put('bookmarks', {
        guideId, partIdx, partTitle, snippet, ts: Date.now()
      });
    },
    async listBookmarks(guideId = null) {
      const all = await this.getAll('bookmarks');
      const filtered = guideId ? all.filter(b => b.guideId === guideId) : all;
      return filtered.sort((a,b) => b.ts - a.ts);
    },
    async deleteBookmark(id) {
      return this.delete('bookmarks', id);
    },
    async findBookmark(guideId, partIdx) {
      const all = await this.listBookmarks(guideId);
      return all.find(b => b.partIdx === partIdx);
    },

    // PDFs
    async savePdf(guideId, blob, originalName) {
      const buf = await blob.arrayBuffer();
      return this.put('pdfs', {
        guideId, buffer: buf, name: originalName,
        size: blob.size, savedAt: Date.now()
      });
    },
    async getPdf(guideId) {
      return this.get('pdfs', guideId);
    },
    async listPdfs() {
      return this.getAll('pdfs');
    },
    async deletePdf(guideId) {
      return this.delete('pdfs', guideId);
    },

    // Títulos personalizados (para reflejar actualizaciones de la norma)
    async getCustomTitle(guideId) {
      const r = await this.get('titles', guideId);
      return r ? r : null;
    },
    async setCustomTitle(guideId, fields) {
      // fields = { title?, code?, subtitle? }
      return this.put('titles', { guideId, ...fields, updatedAt: Date.now() });
    },
    async resetCustomTitle(guideId) {
      return this.delete('titles', guideId);
    },
    async listCustomTitles() {
      return this.getAll('titles');
    }
  };
})();
