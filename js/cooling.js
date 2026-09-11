/*
 * Animation 2 — Cooling of metal into packed grains.
 * Phase 1: a molten cloud of atoms jitters freely (liquid).
 * Phase 2: the atoms decelerate and come to a stop.
 * Phase 3: several nucleation sites appear at once and expand outward —
 *          atoms caught inside a growing grain light up and swell into its
 *          fill texture, while atoms caught on a seam between two grains
 *          fade out, leaving the boundaries empty.
 * Phase 4: hold the fully-formed grain structure.
 * Phase 5: crossfade back to molten and loop.
 */
class CoolingAnimation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rafId = null;
    this.startTime = null;

    this.params = {
      atomCount: 380,
      grainSeedCount: 12,
      meltDuration: 2200,
      settleDuration: 900,
      growDuration: 3400,
      holdDuration: 2600,
      resetDuration: 1200,
      pointSize: 1.3,
      grainExpandScale: 2.2,
      liquidOpacity: 0.3,
      grainOpacity: 1,
      boundaryGap: 10,
      revealSoftness: 14,
    };

    this.schema = [
      { key: 'atomCount', label: 'Atom Count', min: 40, max: 600, step: 10, needsReset: true },
      { key: 'grainSeedCount', label: 'Grain Seed Count', min: 2, max: 60, step: 1, needsReset: true },
      { key: 'meltDuration', label: 'Melt Duration (ms)', min: 500, max: 6000, step: 100 },
      { key: 'settleDuration', label: 'Settle Duration (ms)', min: 200, max: 3000, step: 100 },
      { key: 'growDuration', label: 'Grain Growth Duration (ms)', min: 500, max: 8000, step: 100 },
      { key: 'holdDuration', label: 'Hold Duration (ms)', min: 500, max: 8000, step: 100 },
      { key: 'resetDuration', label: 'Reset/Crossfade (ms)', min: 300, max: 3000, step: 100 },
      { key: 'pointSize', label: 'Atom Point Size', min: 0.5, max: 4, step: 0.1 },
      { key: 'grainExpandScale', label: 'Grain Expand Scale', min: 1, max: 3.5, step: 0.1 },
      { key: 'liquidOpacity', label: 'Liquid Opacity', min: 0, max: 0.8, step: 0.02 },
      { key: 'grainOpacity', label: 'Grain Fill Opacity', min: 0.3, max: 1, step: 0.02 },
      { key: 'boundaryGap', label: 'Boundary Gap (px)', min: 1, max: 24, step: 0.5 },
      { key: 'revealSoftness', label: 'Reveal Softness (px)', min: 2, max: 60, step: 1 },
    ];

    this.reset();
  }

  reset() {
    const { w, h } = cssSize(this.canvas);
    const rng = makeRng(2024);
    const p = this.params;

    const atoms = Array.from({ length: p.atomCount }, () => ({
      x: rng() * w, y: rng() * h,
      phase: rng() * Math.PI * 2,
      speed: 0.6 + rng() * 0.8,
      g1: 0, g2: 0,
    }));

    const seeds = Array.from({ length: p.grainSeedCount }, () => ({
      x: rng() * w, y: rng() * h,
    }));

    // Distance from each atom's resting spot to its nearest (g1) and
    // second-nearest (g2) seed. Fixed once positions are set, so this is
    // computed only here rather than every frame.
    let maxG1 = 0;
    for (const a of atoms) {
      let d1 = Infinity, d2 = Infinity;
      for (const s of seeds) {
        const d = Math.hypot(a.x - s.x, a.y - s.y);
        if (d < d1) { d2 = d1; d1 = d; }
        else if (d < d2) { d2 = d; }
      }
      a.g1 = d1; a.g2 = d2;
      if (d1 > maxG1) maxG1 = d1;
    }

    this.atoms = atoms;
    this.seeds = seeds;
    this.maxG1 = maxG1 || 1;
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
    const { ctx, canvas, atoms } = this;
    const { w, h } = cssSize(canvas);
    const p = this.params;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const tMeltEnd = p.meltDuration;
    const tSettleEnd = tMeltEnd + p.settleDuration;
    const tGrowEnd = tSettleEnd + p.growDuration;
    const tHoldEnd = tGrowEnd + p.holdDuration;
    const total = tHoldEnd + p.resetDuration;
    const te = elapsed % total;

    // Front must clear the farthest atom's g1 by a full revealSoftness
    // margin, otherwise that atom (and its neighbours) never fully crystallize.
    const frontTarget = this.maxG1 + p.revealSoftness;

    let jitterAmp, front, grainFade;
    if (te < tMeltEnd) {
      jitterAmp = 1; front = 0; grainFade = 1;
    } else if (te < tSettleEnd) {
      jitterAmp = 1 - easeInOutCubic((te - tMeltEnd) / p.settleDuration);
      front = 0; grainFade = 1;
    } else if (te < tGrowEnd) {
      jitterAmp = 0;
      front = easeOutCubic((te - tSettleEnd) / p.growDuration) * frontTarget;
      grainFade = 1;
    } else if (te < tHoldEnd) {
      jitterAmp = 0; front = frontTarget; grainFade = 1;
    } else {
      const localT = (te - tHoldEnd) / p.resetDuration;
      jitterAmp = easeInCubic(localT);
      front = frontTarget;
      grainFade = 1 - easeInCubic(localT);
    }

    for (const a of atoms) {
      const x = a.x + Math.sin(elapsed * 0.003 * a.speed + a.phase) * 6 * jitterAmp;
      const y = a.y + Math.cos(elapsed * 0.0035 * a.speed + a.phase * 1.4) * 6 * jitterAmp;

      const revealT = clamp((front - a.g1) / p.revealSoftness, 0, 1);
      const boundaryT = clamp((a.g2 - a.g1) / p.boundaryGap, 0, 1);

      // boundaryT -> 0 near a seam between two grains: the atom fades to
      // nothing instead of filling in, leaving that seam empty.
      const crystalOpacity = lerp(0, p.grainOpacity, boundaryT);
      const crystalSize = lerp(p.pointSize, p.pointSize * p.grainExpandScale, boundaryT);

      const opacity = lerp(p.liquidOpacity, crystalOpacity, revealT * grainFade);
      const size = lerp(p.pointSize, crystalSize, revealT * grainFade);

      if (opacity <= 0.01) continue;
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
