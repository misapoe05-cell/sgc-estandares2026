// practice.js — Flashcards y modo examen
const Practice = {

  async render(slug, container) {
    const guide = State.guidesCache[slug] || await State.loadGuide(slug);
    const cards = this.buildCards(guide);

    if (cards.length === 0) {
      container.innerHTML = '<div class="empty-state">Esta guía no tiene secciones de práctica disponibles.</div>';
      return;
    }

    if (!State._practiceState || State._practiceState.slug !== slug) {
      State._practiceState = { slug, cards, idx: 0, flipped: false };
    }

    this._draw(container);
  },

  _draw(container) {
    const ps = State._practiceState;
    const card = ps.cards[ps.idx];
    container.innerHTML = `
      <div class="practice-stage">
        <div class="practice-meta">${ps.idx + 1} / ${ps.cards.length} · ${card.category}</div>
        <div class="flashcard ${ps.flipped ? 'flipped' : ''}" id="flashcard">
          <span class="face-tag">${ps.flipped ? 'RESPUESTA' : 'PREGUNTA'}</span>
          <div>${ps.flipped ? card.back : card.front}</div>
        </div>
        <div class="practice-controls">
          <button class="btn-prev" onclick="practicePrev()">‹ Anterior</button>
          <button class="btn-next" onclick="practiceNext()">${ps.flipped ? 'Siguiente ›' : 'Voltear'}</button>
        </div>
      </div>
    `;
    document.getElementById('flashcard').onclick = () => {
      State._practiceState.flipped = !State._practiceState.flipped;
      this._draw(container);
    };
  },

  buildCards(guide) {
    const cards = [];
    // Usar todos los eval_part_indices, o el índice principal como fallback
    let indices = guide.eval_part_indices;
    if (!indices || indices.length === 0) {
      if (guide.eval_part_index !== null && guide.eval_part_index !== undefined) {
        indices = [guide.eval_part_index];
      } else {
        return cards;
      }
    }

    for (const idx of indices) {
      const part = guide.parts[idx];
      if (!part) continue;

      let currentLevel = '';
      let currentSection = '';

      for (const b of part.blocks) {
        if (b.type === 'h2') {
          currentSection = stripHtml(b.text);
        } else if (b.type === 'h3') {
          currentLevel = stripHtml(b.text);
        } else if (b.type === 'list') {
          // Detectar si esta lista es de autoevaluación (en parte de autoevaluación
          // o sección con "autoevaluación" en su título)
          const isEvalPart = part.title.toLowerCase().includes('autoevaluación');
          const isEvalSection = currentSection.toLowerCase().includes('autoevaluación');
          if (isEvalPart || isEvalSection) {
            for (const item of b.items) {
              const text = stripHtml(item).trim();
              if (text.length < 10) continue;
              cards.push({
                category: currentLevel || 'Autoevaluación',
                front: text,
                back: 'Repasa la guía para confirmar tu respuesta. Esta pregunta corresponde a la categoría: <em>' + (currentLevel || 'Autoevaluación') + '</em>.'
              });
            }
          }
        } else if (b.type === 'table') {
          // Tabla de errores frecuentes (3 columnas: Error, Consecuencia, Cómo evitarlo)
          const isErrorsPart = part.title.toLowerCase().includes('errores frecuentes') ||
                               part.title.toLowerCase().includes('cómo evitarlos');
          const isErrorsSection = currentSection.toLowerCase().includes('errores frecuentes') ||
                                  currentSection.toLowerCase().includes('cómo evitarlos');
          if (isErrorsPart || isErrorsSection) {
            const rows = b.rows;
            if (rows.length < 2) continue;
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (r.length < 2) continue;
              const front = '¿Por qué es un error: <strong>' + stripHtml(r[0]) + '</strong>?';
              const back = '<strong>Consecuencia:</strong> ' + stripHtml(r[1] || '') +
                           (r[2] ? '<br><br><strong>Cómo evitarlo:</strong> ' + stripHtml(r[2]) : '');
              cards.push({ category: 'Error frecuente', front, back });
            }
          }
        }
      }
    }
    return cards;
  },

  // Modo examen: preguntas aleatorias de varias guías con opciones múltiples generadas
  async startExam(scope = 'all') {
    // scope: 'all', 'concreto', 'geotecnia', un slug específico
    const allGuides = [];
    for (const m of State.manifest) {
      if (scope === 'all' || m.category.toLowerCase() === scope.toLowerCase() || m.slug === scope) {
        const g = State.guidesCache[m.slug] || await State.loadGuide(m.slug);
        allGuides.push({ m, g });
      }
    }

    // Preguntas con respuestas extraíbles: usamos la tabla de "Errores frecuentes"
    // donde "Error" es la pregunta-trampa y "Cómo evitarlo" es la respuesta correcta
    const questions = [];
    for (const { m, g } of allGuides) {
      const indices = g.eval_part_indices && g.eval_part_indices.length
        ? g.eval_part_indices
        : (g.eval_part_index !== null && g.eval_part_index !== undefined ? [g.eval_part_index] : []);

      for (const idx of indices) {
        const part = g.parts[idx];
        if (!part) continue;
        let inErrors = part.title.toLowerCase().includes('errores frecuentes') ||
                       part.title.toLowerCase().includes('cómo evitarlos');
        for (const b of part.blocks) {
          if (b.type === 'h2') {
            const t = stripHtml(b.text).toLowerCase();
            inErrors = t.includes('errores frecuentes') || t.includes('cómo evitarlos') || inErrors;
          }
          if (b.type === 'table' && inErrors) {
            for (let i = 1; i < b.rows.length; i++) {
              const r = b.rows[i];
              if (r.length < 3) continue;
              const error    = stripHtml(r[0]);
              const consec   = stripHtml(r[1]);
              const correct  = stripHtml(r[2]);
              if (correct.length < 15) continue;
              questions.push({
                guideId: m.id,
                question: `Sobre la práctica: <em>"${error}"</em>. ¿Cuál es la forma correcta de evitarlo?`,
                correct,
                context: consec
              });
            }
          }
        }
      }
    }

    if (questions.length < 4) {
      State.toast('Faltan preguntas para el examen');
      return;
    }

    // Mezclar
    questions.sort(() => Math.random() - 0.5);
    const total = Math.min(10, questions.length);
    const selected = questions.slice(0, total);

    // Generar opciones incorrectas tomando "correct" de OTRAS preguntas
    for (const q of selected) {
      const distractors = questions
        .filter(other => other !== q && other.correct !== q.correct)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(o => o.correct);
      const options = [q.correct, ...distractors].sort(() => Math.random() - 0.5);
      q.options = options;
      q.correctIdx = options.indexOf(q.correct);
    }

    State._examState = {
      questions: selected,
      idx: 0,
      answers: [],   // {chosen, correct}
      done: false
    };

    State.navigate('exam');
    this._drawExam();
  },

  _drawExam() {
    const view = document.getElementById('viewExam');
    const ex = State._examState;
    if (!ex) return;

    if (ex.done) {
      const score = ex.answers.filter(a => a.chosen === a.correct).length;
      const pct = Math.round((score / ex.questions.length) * 100);
      view.innerHTML = `
        <div class="exam-summary">
          <div class="score-num">${pct}%</div>
          <div class="score-label">${score} de ${ex.questions.length} correctas</div>
          <button onclick="State._examState=null;State.navigate('home')">Volver al inicio</button>
        </div>
      `;
      return;
    }

    const q = ex.questions[ex.idx];
    view.innerHTML = `
      <div class="exam-progress">Pregunta ${ex.idx+1} de ${ex.questions.length}</div>
      <div class="exam-card">
        <div class="meta">${q.guideId}</div>
        <div class="question">${q.question}</div>
        <div class="exam-options" id="examOpts">
          ${q.options.map((opt, i) => `<button data-i="${i}" onclick="answerExam(${i})">${opt}</button>`).join('')}
        </div>
      </div>
    `;
  },

  answerExam(i) {
    const ex = State._examState;
    const q = ex.questions[ex.idx];
    ex.answers.push({ chosen: i, correct: q.correctIdx });

    // Mostrar resultado en botones
    const opts = document.querySelectorAll('#examOpts button');
    opts.forEach((b, idx) => {
      b.disabled = true;
      if (idx === q.correctIdx) b.classList.add('correct');
      if (idx === i && i !== q.correctIdx) b.classList.add('wrong');
    });

    setTimeout(() => {
      ex.idx++;
      if (ex.idx >= ex.questions.length) ex.done = true;
      this._drawExam();
    }, 1400);
  }
};

function practiceNext() {
  const ps = State._practiceState;
  if (!ps.flipped) {
    ps.flipped = true;
  } else {
    ps.flipped = false;
    ps.idx = (ps.idx + 1) % ps.cards.length;
  }
  Practice._draw(document.getElementById('guideTabContent'));
}

function practicePrev() {
  const ps = State._practiceState;
  ps.flipped = false;
  ps.idx = (ps.idx - 1 + ps.cards.length) % ps.cards.length;
  Practice._draw(document.getElementById('guideTabContent'));
}

function answerExam(i) {
  Practice.answerExam(i);
}

function startExamForCurrent() {
  const slug = State.currentGuide;
  if (!slug) {
    Practice.startExam('all');
  } else {
    // Modal preguntando si solo esa guía o todas
    State.showModal('Modo examen', `
      <p class="meta">Selecciona el alcance del examen:</p>
      <button class="btn-block" onclick="State.hideModal();Practice.startExam('${slug}')">Solo esta guía</button>
      <button class="btn-block" onclick="State.hideModal();Practice.startExam('Concreto')">Todas las de Concreto</button>
      <button class="btn-block" onclick="State.hideModal();Practice.startExam('Geotecnia')">Todas las de Geotecnia</button>
      <button class="btn-block" onclick="State.hideModal();Practice.startExam('all')">Todas las guías</button>
    `);
  }
}
