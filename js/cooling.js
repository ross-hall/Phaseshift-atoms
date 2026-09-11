/*
 * Animation 2 — Cooling of metal into packed grains.
 * Phase 1: a molten cloud of atoms jitters freely.
 * Phase 2: nucleation sites appear and grain boundaries grow outward from
 *          them (a Voronoi front-reveal), the way solidifying metal forms grains.
 * Phase 3: hold the fully-formed grain structure.
 * Phase 4: crossfade back to molten and loop.
 */
class CoolingAnimation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rafId = null;
    this.startTime = null;

    this.params = {
      atomCount: 140,
      grainSeedCount: 18,
      meltDuration: 2600,
      growDuration: 3400,
      holdDuration: 2600,
      resetDuration: 1200,
      pointSize: 1.6,
      boundaryOpacity: 0.85,
    };

    this.schema = [
      { key: 'atomCount', label: 'Molten Atom Count', min: 20, max: 400, step: 5, needsReset: true },
      { key: 'grainSeedCount', label: 'Grain Seed Count', min: 3, max: 60, step: 1, needsReset: true },
      { key: 'meltDuration', label: 'Melt Duration (ms)', min: 500, max: 6000, step: 100 },
      { key: 'growDuration', label: 'Grain Growth Duration (ms)', min: 500, max: 8000, step: 100, needsReset: true },
      { key: 'holdDuration', label: 'Hold Duration (ms)', min: 500, max: 8000, step: 100 },
      { key: 'resetDuration', label: 'Reset/Crossfade (ms)', min: 300, max: 3000, step: 100 },
      { key: 'pointSize', label: 'Point Size', min: 0.5, max: 4, step: 0.1 },
      { key: 'boundaryOpacity', label: 'Boundary Opacity', min: 0.1, max: 1, step: 0.05 },
    ];

    this.reset();
  }

  reset() {
    const { w, h } = cssSize(this.canvas);
    const rng = makeRng(2024);
    const p = this.params;

    this.moltenAtoms = Array.from({ length: p.atomCount }, () => ({
      x: rng() * w, y: rng() * h,
      phase: rng() * Math.PI * 2,
      speed: 0.6 + rng() * 0.8,
    }));

    this.seeds = Array.from({ length: p.grainSeedCount }, () => ({
      x: rng() * w, y: rng() * h,
    }));

    this._buildGrid(w, h);
  }

  // Precompute a distance field: for every sample cell, the distance to the
  // nearest seed (its growth front) and whether it sits on a grain boundary
  // (roughly equidistant between two seeds). Sorted by front distance so the
  // render loop can reveal boundary points progressively without recomputing.
  _buildGrid(w, h) {
    const step = Math.max(4, Math.round(Math.min(w, h) / 90));
    const seeds = this.seeds;
    const boundaryPts = [];
    for (let y = 0; y <= h; y += step) {
      for (let x = 0; x <= w; x += step) {
        let d1 = Infinity, d2 = Infinity;
        for (const s of seeds) {
          const d = Math.hypot(x - s.x, y - s.y);
          if (d < d1) { d2 = d1; d1 = d; }
          else if (d < d2) { d2 = d; }
        }
        if (d2 - d1 < step * 1.6) boundaryPts.push({ x, y, front: d1 });
      }
    }
    boundaryPts.sort((a, b) => a.front - b.front);
    this.boundaryPts = boundaryPts;
    this.maxFront = boundaryPts.length ? boundaryPts[boundaryPts.length - 1].front : 1;
  }

  start() {
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
  }

  resize() { this.reset(); }

  render(elapsed) {
    const { ctx, canvas } = this;
    const { w, h } = cssSize(canvas);
    const p = this.params;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const total = p.meltDuration + p.growDuration + p.holdDuration + p.resetDuration;
    const te = elapsed % total;

    let moltenOpacity = 1, boundaryOpacity = 0, front = 0, showSeeds = false;

    if (te < p.meltDuration) {
      moltenOpacity = 1;
    } else if (te < p.meltDuration + p.growDuration) {
      const localT = (te - p.meltDuration) / p.growDuration;
      front = easeOutCubic(localT) * this.maxFront;
      boundaryOpacity = p.boundaryOpacity;
      moltenOpacity = 1 - clamp(localT / 0.3, 0, 1);
      showSeeds = true;
    } else if (te < p.meltDuration + p.growDuration + p.holdDuration) {
      front = this.maxFront;
      boundaryOpacity = p.boundaryOpacity;
      moltenOpacity = 0;
      showSeeds = true;
    } else {
      const localT = (te - p.meltDuration - p.growDuration - p.holdDuration) / p.resetDuration;
      front = this.maxFront;
      boundaryOpacity = p.boundaryOpacity * (1 - easeInCubic(localT));
      moltenOpacity = easeOutCubic(localT);
      showSeeds = boundaryOpacity > 0.02;
    }

    if (moltenOpacity > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${moltenOpacity})`;
      for (const a of this.moltenAtoms) {
        const x = a.x + Math.sin(elapsed * 0.003 * a.speed + a.phase) * 6;
        const y = a.y + Math.cos(elapsed * 0.0035 * a.speed + a.phase * 1.4) * 6;
        ctx.beginPath();
        ctx.arc(x, y, p.pointSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (boundaryOpacity > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${boundaryOpacity})`;
      const pts = this.boundaryPts;
      let lo = 0, hi = pts.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (pts[mid].front <= front) lo = mid + 1; else hi = mid;
      }
      for (let i = 0; i < lo; i++) {
        ctx.fillRect(pts[i].x, pts[i].y, 1.6, 1.6);
      }
      if (showSeeds) {
        ctx.strokeStyle = `rgba(255,255,255,${boundaryOpacity})`;
        for (const s of this.seeds) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, p.pointSize * 1.6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }
}
