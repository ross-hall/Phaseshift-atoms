/* Wires up tabs, instantiates each animation, and renders a live variable panel. */
(function () {
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('canvas');
  const controlsEl = document.getElementById('controls');
  const panelTitle = document.getElementById('panel-title');
  const resetBtn = document.getElementById('reset-btn');
  const tabButtons = document.querySelectorAll('.tab');

  setupCanvas(canvas, stage);

  const registry = {
    lattice: { label: 'Lattice Formation — Variables', ctor: LatticeAnimation },
    cooling: { label: 'Cooling & Grains — Variables', ctor: CoolingAnimation },
    cloud: { label: 'Solution Selection — Variables', ctor: CloudAnimation },
  };

  const instances = {};
  function getInstance(key) {
    if (!instances[key]) instances[key] = new registry[key].ctor(canvas);
    return instances[key];
  }

  let current = null;
  let currentKey = null;

  function buildControls(key) {
    const inst = getInstance(key);
    controlsEl.innerHTML = '';
    panelTitle.textContent = registry[key].label;

    for (const field of inst.schema) {
      const wrap = document.createElement('div');
      wrap.className = 'control';

      if (field.type === 'checkbox') {
        wrap.innerHTML = `
          <div class="checkbox-row">
            <span>${field.label}</span>
            <input type="checkbox" ${inst.params[field.key] ? 'checked' : ''} />
          </div>`;
        const input = wrap.querySelector('input');
        input.addEventListener('change', () => {
          inst.params[field.key] = input.checked;
        });
      } else {
        const val = inst.params[field.key];
        wrap.innerHTML = `
          <div class="control-row">
            <span>${field.label}</span>
            <span class="value">${formatVal(val)}</span>
          </div>
          <input type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${val}" />`;
        const input = wrap.querySelector('input');
        const valueEl = wrap.querySelector('.value');
        input.addEventListener('input', () => {
          const v = parseFloat(input.value);
          inst.params[field.key] = v;
          valueEl.textContent = formatVal(v);
          if (field.needsReset) inst.reset();
        });
      }
      controlsEl.appendChild(wrap);
    }
  }

  function formatVal(v) {
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }

  function activate(key) {
    if (current) current.stop();
    currentKey = key;
    current = getInstance(key);
    current.resize();
    buildControls(key);
    current.start();

    tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.anim === key));
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.dataset.anim));
  });

  resetBtn.addEventListener('click', () => {
    if (current) current.reset();
  });

  window.addEventListener('resize', () => {
    if (current) current.resize();
  });

  activate('lattice');
})();
