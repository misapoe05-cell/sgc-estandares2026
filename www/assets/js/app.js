// app.js — Bootstrap principal, event handlers globales, settings
(async function() {

  // Espera DOM
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r));
  }

  // Cargar manifest
  await State.loadManifest();

  // Cargar settings
  const theme = await DB.getSetting('theme', 'light');
  applyTheme(theme);
  const fontSize = await DB.getSetting('fontSize', 'md');
  applyFontSize(fontSize);

  // Marcar segmentos activos
  document.querySelectorAll('#themeControl button').forEach(b => {
    b.classList.toggle('active', b.dataset.value === theme);
  });
  document.querySelectorAll('#fontControl button').forEach(b => {
    b.classList.toggle('active', b.dataset.value === fontSize);
  });

  // === Wire up bottom nav ===
  document.querySelectorAll('.bottom-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      State.history = []; // reiniciar pila al usar nav inferior
      State.navigate(target);
    });
  });

  // Back button
  document.getElementById('btnBack').addEventListener('click', () => State.back());

  // === Home filter chips ===
  document.querySelectorAll('.filter-chips .chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('.filter-chips .chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      Views.renderHome();
    });
  });

  // === Home search ===
  document.getElementById('homeSearch').addEventListener('input', debounce(() => {
    Views.renderHome();
  }, 250));

  // === Global search ===
  document.getElementById('globalSearch').addEventListener('input', debounce(() => {
    Views.renderSearch();
  }, 350));
  document.getElementById('searchClear').addEventListener('click', () => {
    document.getElementById('globalSearch').value = '';
    Views.renderSearch();
  });

  // === Guide tabs ===
  document.querySelectorAll('#guideTabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      State.currentTab = tab;
      Views.render();
    });
  });

  // === Settings ===
  document.querySelectorAll('#themeControl button').forEach(b => {
    b.addEventListener('click', async () => {
      document.querySelectorAll('#themeControl button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      await DB.setSetting('theme', b.dataset.value);
      applyTheme(b.dataset.value);
    });
  });
  document.querySelectorAll('#fontControl button').forEach(b => {
    b.addEventListener('click', async () => {
      document.querySelectorAll('#fontControl button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      await DB.setSetting('fontSize', b.dataset.value);
      applyFontSize(b.dataset.value);
    });
  });
  document.getElementById('btnExport').addEventListener('click', exportData);
  document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importData);
  document.getElementById('btnReset').addEventListener('click', async () => {
    if (confirm('Esto borrará TODAS tus notas, marcadores, progreso y PDFs cargados. ¿Continuar?')) {
      await DB.clearAll();
      State.toast('Todo restablecido');
      State.navigate('home');
    }
  });

  // === FAB y file input ===
  document.getElementById('fabAddPdf').addEventListener('click', () => {
    document.getElementById('pdfFileInput').click();
  });
  document.getElementById('pdfFileInput').addEventListener('change', e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) handlePdfUpload(f);
  });

  // === Modal ===
  document.getElementById('modalClose').addEventListener('click', () => State.hideModal());
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) State.hideModal();
  });

  // === Hardware back (Android) ===
  document.addEventListener('backbutton', e => {
    e.preventDefault();
    if (!document.getElementById('modalOverlay').hidden) {
      State.hideModal();
    } else if (State.currentView !== 'home') {
      if (!State.back()) State.navigate('home');
    } else if (window.Capacitor && Capacitor.Plugins.App) {
      Capacitor.Plugins.App.exitApp();
    }
  }, false);

  // === Splash ===
  setTimeout(() => {
    document.getElementById('splash').classList.add('hidden');
  }, 700);

  // === Render inicial ===
  await Views.render();

})();

// Helpers
function applyTheme(t) {
  if (t === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.dataset.theme = prefersDark ? 'dark' : 'light';
  } else {
    document.body.dataset.theme = t;
  }
}
function applyFontSize(s) {
  document.body.dataset.font = s;
}
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// === Export / Import ===
async function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes:     await DB.getAll('notes'),
    bookmarks: await DB.getAll('bookmarks'),
    progress:  await DB.getAll('progress'),
    settings:  await DB.getAll('settings')
    // PDFs no se exportan (son grandes)
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sgc-normas-respaldo-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  State.toast('✓ Respaldo descargado');
}

async function importData(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.version) throw new Error('Archivo no válido');

    if (!confirm('Esto fusionará el respaldo con tus datos actuales. ¿Continuar?')) return;

    if (data.notes)     for (const n of data.notes)     await DB.put('notes', n);
    if (data.bookmarks) for (const b of data.bookmarks) {
      // Re-insertar como nuevos para no chocar IDs
      delete b.id;
      await DB.put('bookmarks', b);
    }
    if (data.progress)  for (const p of data.progress)  await DB.put('progress', p);
    if (data.settings)  for (const s of data.settings)  await DB.put('settings', s);

    // Re-aplicar settings
    const theme = await DB.getSetting('theme', 'light');
    applyTheme(theme);
    const fs = await DB.getSetting('fontSize', 'md');
    applyFontSize(fs);

    State.toast('✓ Respaldo importado');
    Views.render();
  } catch (err) {
    State.toast('Error al importar: ' + err.message);
  }
}
