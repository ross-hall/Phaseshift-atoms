/*
 * Animation 5 — Material properties card.
 *
 * A DOM/CSS overlay (not canvas-drawn) rather than a generative animation:
 * a card tracking five alloy properties against target bands as the
 * material moves through three stages —
 *   1. Requirement — the client's target range is fixed; no measured
 *      values shown yet.
 *   2. Design — simulation searches the design space: each bar jitters to
 *      a new value on an interval, lighting up whenever it lands inside
 *      its band. A "Simulating…" indicator with animated dots signals
 *      it's actively computing.
 *   3. Supply — the real, measured material: every bar is locked inside
 *      its band.
 *
 * The three stages auto-advance and loop, matching the rest of the app's
 * self-playing animations; clicking a stage pill manually pins the card
 * to it (Reset resumes the auto-cycle from Requirement).
 */
class MaterialAnimation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rafId = null;
    this.startTime = null;
    this.manualStage = null;
    this.currentStage = null;

    this.params = {
      requirementDuration: 3000,
      designDuration: 6000,
      supplyDuration: 3000,
      jitterInterval: 450,
      accentColor: '#d9822b',
    };

    this.schema = [
      { key: 'requirementDuration', label: 'Requirement Hold (ms)', min: 1000, max: 8000, step: 100 },
      { key: 'designDuration', label: 'Design Hold (ms)', min: 2000, max: 15000, step: 200 },
      { key: 'supplyDuration', label: 'Supply Hold (ms)', min: 1000, max: 8000, step: 100 },
      { key: 'jitterInterval', label: 'Simulation Jitter Interval (ms)', min: 150, max: 1500, step: 50 },
      { key: 'accentColor', label: 'In-Range Accent Color', type: 'color' },
    ];

    this.rows = [
      { key: 'hardness', label: 'Hardness', bandMin: 38, bandMax: 56, lockPct: 47 },
      { key: 'wear', label: 'Wear Resistance', bandMin: 60, bandMax: 82, lockPct: 71 },
      { key: 'strength', label: 'Strength', bandMin: 22, bandMax: 42, lockPct: 33 },
      { key: 'corrosion', label: 'Corrosion Resistance', bandMin: 66, bandMax: 86, lockPct: 78 },
      { key: 'printability', label: 'Printability', bandMin: 48, bandMax: 66, lockPct: 58 },
    ];

    this.stageMeta = {
      requirement: { label: 'Range Fixed', caption: "The client's target range is fixed from the start — it never moves." },
      design: { label: 'Simulating', caption: 'Simulation searches the design space; values drift and light up whenever they land inside range.' },
      supply: { label: 'Locked', caption: 'Measured on real material — every property sits inside range, locked.' },
    };

    this._buildDom();
  }

  _buildDom() {
    this.overlay = document.getElementById('material-overlay');

    const rowsHtml = this.rows.map((r) => `
      <div class="material-row" data-key="${r.key}">
        <div class="material-row-label">${r.label}</div>
        <div class="material-bar-track">
          <div class="material-band"></div>
          <div class="material-bar-fill hidden"></div>
        </div>
      </div>`).join('');

    this.overlay.innerHTML = `
      <div class="material-stage">
        <div class="material-tabs">
          <button data-stage="requirement">01 Requirement</button>
          <button data-stage="design">02 Design</button>
          <button data-stage="supply">03 Supply</button>
        </div>
        <div class="material-card">
          <div class="material-card-head">
            <h2>Material Properties</h2>
            <span class="material-card-state"><span class="label"></span><span class="dots"></span></span>
          </div>
          ${rowsHtml}
        </div>
        <p class="material-caption"></p>
      </div>`;

    for (const r of this.rows) {
      const band = this.overlay.querySelector(`.material-row[data-key="${r.key}"] .material-band`);
      band.style.left = r.bandMin + '%';
      band.style.width = (r.bandMax - r.bandMin) + '%';
    }

    this.tabButtons = this.overlay.querySelectorAll('.material-tabs button');
    this.stateLabelEl = this.overlay.querySelector('.material-card-state .label');
    this.dotsEl = this.overlay.querySelector('.material-card-state .dots');
    this.captionEl = this.overlay.querySelector('.material-caption');

    this.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => { this.manualStage = btn.dataset.stage; });
    });
  }

  setImage() {}
  clearImage() {}

  reset() {
    this.manualStage = null;
    this.currentStage = null;
  }

  start() {
    this.overlay.classList.add('active');
    this.startTime = performance.now();
    const loop = (now) => {
      this.render(now - this.startTime);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.overlay.classList.remove('active');
  }

  resize() {}

  // Cheap seeded hash -> [0,1), used so each row's jittered value is a
  // pure function of (row, time slot) rather than persisted state.
  _hash01(a, b) {
    let h = (a * 374761393 + b * 668265263) ^ (a << 13);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  render(elapsed) {
    const { ctx, canvas } = this;
    const { w, h } = cssSize(canvas);
    ctx.fillStyle = AppTheme.bgColor;
    ctx.fillRect(0, 0, w, h);

    const p = this.params;
    const total = p.requirementDuration + p.designDuration + p.supplyDuration;
    let stage, stageElapsed;
    if (this.manualStage) {
      stage = this.manualStage;
      stageElapsed = elapsed;
    } else {
      const te = elapsed % total;
      if (te < p.requirementDuration) { stage = 'requirement'; stageElapsed = te; }
      else if (te < p.requirementDuration + p.designDuration) { stage = 'design'; stageElapsed = te - p.requirementDuration; }
      else { stage = 'supply'; stageElapsed = te - p.requirementDuration - p.designDuration; }
    }

    if (stage !== this.currentStage) {
      this.currentStage = stage;
      this.tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.stage === stage));
      this.captionEl.textContent = this.stageMeta[stage].caption;
    }
    this.stateLabelEl.textContent = this.stageMeta[stage].label;
    this.dotsEl.textContent = stage === 'design' ? '.'.repeat(1 + Math.floor(elapsed / 350) % 3) : '';

    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i];
      const fillEl = this.overlay.querySelector(`.material-row[data-key="${r.key}"] .material-bar-fill`);

      if (stage === 'requirement') {
        fillEl.classList.add('hidden');
        continue;
      }
      fillEl.classList.remove('hidden');

      if (stage === 'supply') {
        fillEl.style.width = r.lockPct + '%';
        fillEl.style.background = p.accentColor;
      } else {
        const slot = Math.floor(stageElapsed / p.jitterInterval);
        const pct = this._hash01(i, slot) * 100;
        const inRange = pct >= r.bandMin && pct <= r.bandMax;
        fillEl.style.width = pct + '%';
        fillEl.style.background = inRange ? p.accentColor : '';
      }
    }
  }
}
