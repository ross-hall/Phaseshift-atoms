/*
 * Animation 3 — A cloud of alloy solutions; most drift and dim away while a
 * handful are selected, brighten, and converge into a tight group at the centre.
 */
class CloudAnimation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rafId = null;
    this.startTime = null;
    this.cycleIndex = -1;

    this.params = {
      particleCount: 220,
      selectedCount: 7,
      cloudRadiusFraction: 0.42,
      groupRadius: 22,
      particleSize: 2,
      dimOpacity: 0.12,
      highlightOpacity: 1,
      driftSpeed: 1,
      cycleDuration: 10000,
    };

    this.schema = [
      { key: 'particleCount', label: 'Particle Count', min: 40, max: 500, step: 10, needsReset: true },
      { key: 'selectedCount', label: 'Selected Count', min: 2, max: 24, step: 1 },
      { key: 'cloudRadiusFraction', label: 'Cloud Radius', min: 0.15, max: 0.5, step: 0.01 },
      { key: 'groupRadius', label: 'Group Radius', min: 8, max: 60, step: 1 },
      { key: 'particleSize', label: 'Particle Size', min: 0.8, max: 5, step: 0.1 },
      { key: 'dimOpacity', label: 'Dim Opacity', min: 0, max: 0.5, step: 0.02 },
      { key: 'highlightOpacity', label: 'Highlight Opacity', min: 0.3, max: 1, step: 0.02 },
      { key: 'driftSpeed', label: 'Drift Speed', min: 0.1, max: 3, step: 0.05 },
      { key: 'cycleDuration', label: 'Cycle Duration (ms)', min: 4000, max: 24000, step: 500 },
    ];

    this.reset();
  }

  reset() {
    const rng = makeRng(77);
    const p = this.params;
    this.particles = Array.from({ length: p.particleCount }, () => ({
      angle: rng() * Math.PI * 2,
      radiusFrac: Math.sqrt(rng()),
      angleSpeed: (rng() - 0.5) * 0.6,
      radiusPhase: rng() * Math.PI * 2,
      radiusFreq: 0.3 + rng() * 0.5,
      groupSlot: 0,
    }));
    this.cycleIndex = -1;
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

  resize() { /* geometry is fraction-based, no rebuild needed */ }

  _prepareCycle(index) {
    const rng = makeRng(1000 + index);
    const p = this.params;
    const ids = this.particles.map((_, i) => i);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const selected = new Set(ids.slice(0, p.selectedCount));
    for (const id of selected) {
      this.particles[id].groupSlot = rng();
    }
    this.selected = selected;
    this.cycleIndex = index;
  }

  _cloudPos(particle, t, cx, cy, cloudRadius) {
    const p = this.params;
    const angle = particle.angle + particle.angleSpeed * t * p.driftSpeed;
    const r = cloudRadius * particle.radiusFrac *
      (1 + 0.06 * Math.sin(t * particle.radiusFreq + particle.radiusPhase));
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }

  render(elapsedMs) {
    const { ctx, canvas } = this;
    const { w, h } = cssSize(canvas);
    const p = this.params;
    ctx.fillStyle = AppTheme.bgColor;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const cloudRadius = Math.min(w, h) * p.cloudRadiusFraction;
    const cycleIndex = Math.floor(elapsedMs / p.cycleDuration);
    if (cycleIndex !== this.cycleIndex) this._prepareCycle(cycleIndex);

    const t = elapsedMs / 1000;
    const tn = (elapsedMs % p.cycleDuration) / p.cycleDuration;
    const phases = cyclePhase(tn, [
      { len: 0.28, from: 0, to: 0, ease: easeInOutCubic },  // drift, baseline
      { len: 0.27, from: 0, to: 1, ease: easeInOutCubic },  // converge / select
      { len: 0.25, from: 1, to: 1, ease: easeInOutCubic },  // hold grouped
      { len: 0.20, from: 1, to: 0, ease: easeInOutCubic },  // release
    ]);
    const groupF = phases.value; // 0 = pure cloud, 1 = fully grouped

    const baseline = (p.dimOpacity + p.highlightOpacity) / 2;
    const positions = new Array(this.particles.length);

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const cloud = this._cloudPos(particle, t, cx, cy, cloudRadius);
      const isSelected = this.selected.has(i);

      let x = cloud.x, y = cloud.y, opacity;
      if (isSelected) {
        const slotAngle = particle.groupSlot * Math.PI * 2;
        const gx = cx + Math.cos(slotAngle) * p.groupRadius;
        const gy = cy + Math.sin(slotAngle) * p.groupRadius;
        x = lerp(cloud.x, gx, groupF);
        y = lerp(cloud.y, gy, groupF);
        opacity = lerp(baseline, p.highlightOpacity, groupF);
      } else {
        opacity = lerp(baseline, p.dimOpacity, groupF);
      }
      positions[i] = { x, y, opacity, isSelected };
    }

    for (const pt of positions) {
      ctx.fillStyle = `rgba(255,255,255,${pt.opacity})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, p.particleSize * (pt.isSelected ? 1 + 0.6 * groupF : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
