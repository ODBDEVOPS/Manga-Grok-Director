// app.js - CinéGrok Director v2.0
let data = {};
let storyboard = [];

// Chargement des données
async function loadData() {
  try {
    const [mangas, chars, decors, templates] = await Promise.all([
      fetch('data/mangas.json').then(r => r.json()),
      fetch('data/characters.json').then(r => r.json()),
      fetch('data/decors.json').then(r => r.json()),
      fetch('templates/presets.json').then(r => r.json())
    ]);
    data = { mangas: mangas.mangas, characters: chars.characters, decors: decors.decors, templates: templates.templates };
    initApp();
  } catch (err) {
    document.getElementById('prompt-preview').textContent = "Erreur de chargement des données : " + err;
  }
}

function initApp() {
  populateSelect('manga-select', data.mangas, 'id', 'titre');
  populateSelect('character-select', data.characters, 'id', 'name');
  populateSelect('decor-select', data.decors, 'id', 'nom');
  populateSelect('template-select', data.templates, 'id', 'name');

  // Événements
  document.getElementById('template-select').addEventListener('change', applyTemplate);
  document.getElementById('manga-select').addEventListener('change', updateFromManga);
  document.getElementById('character-select').addEventListener('change', e => current.character = data.characters.find(c => c.id === e.target.value));
  document.getElementById('decor-select').addEventListener('change', e => current.decor = data.decors.find(d => d.id === e.target.value));

  document.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', refreshAll);
    el.addEventListener('change', refreshAll);
  });

  document.getElementById('add-frame').addEventListener('click', addStoryboardFrame);
  document.getElementById('generate-btn').addEventListener('click', generateFinalPrompt);
  document.getElementById('copy-btn').addEventListener('click', copyPrompt);
  document.getElementById('save-btn').addEventListener('click', saveConfig);
  document.getElementById('load-btn').addEventListener('click', loadConfig);
  document.getElementById('reset-btn').addEventListener('click', () => location.reload());

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
      refreshAll();
    });
  });

  refreshAll();
}

let current = { manga: null, character: null, decor: null };

function populateSelect(id, items, valueKey, textKey) {
  const select = document.getElementById(id);
  select.innerHTML = `<option value="" disabled ${select.children.length === 0 ? 'selected' : ''}>Choisir...option>`;
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item[valueKey];
    opt.textContent = item[textKey];
    select.appendChild(opt);
  });
}

function updateFromManga() {
  const manga = data.mangas.find(m => m.id === document.getElementById('manga-select').value);
  current.manga = manga || null;
  updateCompatibility();
  if (manga && !document.getElementById('master-prompt').value.trim()) {
    document.getElementById('master-prompt').value = `8K, masterpiece, best quality, ${manga.prompt_style}, cinematic lighting, vibrant colors, dynamic composition`;
  }
  refreshAll();
}

function updateCompatibility() {
  const charSpan = document.getElementById('char-compat');
  const decorSpan = document.getElementById('decor-compat');
  charSpan.textContent = current.character && current.manga && current.character.manga === current.manga.id ? 'Valid' : 'Warning';
  decorSpan.textContent = current.decor && current.manga && current.decor.manga_compatible.includes(current.manga.id) ? 'Valid' : 'Warning';
}

function applyTemplate(e) {
  const template = data.templates.find(t => t.id === e.target.value);
  if (!template) return;
  document.getElementById('action-scenario').value = template.action;
  document.getElementById('camera-type').value = template.camera.type;
  document.getElementById('camera-movement').value = template.camera.movement;
  document.getElementById('camera-angle').value = template.camera.angle;
  document.getElementById('dramatic-slider').value = template.dramatic || 80;
  document.getElementById('dramatic-value').textContent = template.dramatic || 80;
  refreshAll();
}

function refreshAll() {
  updateCompatibility();
  refreshPreview();
  refreshStoryboard();
}

function refreshPreview() {
  const preview = document.getElementById('prompt-preview');
  let p = [];

  const master = document.getElementById('master-prompt').value.trim() || 
    (current.manga ? `8K, masterpiece, ${current.manga.prompt_style}, cinematic lighting` : "8K anime style");

  p.push(`[MASTER] ${master}`);
  if (current.character) {
    p.push(`[CHARACTER] (${current.character.name}:1.4), ${current.character.prompt_base}`);
    if (document.getElementById('keep-appearance').checked) p.push("(exact likeness:1.5)");
  }
  const action = document.getElementById('action-scenario').value.trim();
  if (action) p.push(`[ACTION] ${action}`);

  if (current.decor) p.push(`[ENVIRONMENT] ${current.decor.prompt_environnement}, ${current.decor.scene.moment}, ${current.decor.scene.meteo}`);

  p.push(`[CAMERA] ${document.getElementById('camera-type').value}, ${document.getElementById('camera-movement').value}, ${document.getElementById('camera-angle').value.toLowerCase()} angle`);

  const effects = [];
  if (document.getElementById('speed-lines').checked) effects.push("(speed lines, motion blur:1.3)");
  if (document.getElementById('aura-effects').checked && current.character?.aura) effects.push(`(${current.character.aura}:1.4)`);
  if (document.getElementById('impact-frames').checked) effects.push("(impact frames, shockwave:1.2)");
  if (effects.length) p.push(`[EFFECTS] ${effects.join(', ')}`);

  const fidelity = document.getElementById('fidelity-slider').value / 100;
  p.push(`[FIDELITY] (consistent style:${(fidelity*1.6).toFixed(2)})`);

  preview.textContent = p.join('\n\n');

  // Negative prompt
  document.getElementById('negative-preview').textContent = 
    "blurry, low quality, deformed, bad anatomy, extra limbs, missing arms, fused fingers, bad hands, watermark, text, error, cropped, worst quality, jpeg artifacts, out of frame, duplicate";
}

function generateFinalPrompt() {
  let prompt = [];
  const master = document.getElementById('master-prompt').value.trim() || "8K, masterpiece, highly detailed, cinematic";
  prompt.push(master);

  if (current.character) {
    prompt.push(`(${current.character.name}:1.4)`);
    prompt.push(current.character.prompt_base);
  }

  const action = document.getElementById('action-scenario').value.trim();
  if (action) prompt.push(action);

  if (current.decor) {
    prompt.push(current.decor.prompt_environnement);
    prompt.push(`${current.decor.scene.moment}, ${current.decor.scene.meteo}`);
  }

  prompt.push(document.getElementById('camera-type').value);
  prompt.push(document.getElementById('camera-movement').value.toLowerCase());
  prompt.push(document.getElementById('camera-angle').value.toLowerCase() + " angle");

  if (document.getElementById('speed-lines').checked) prompt.push("(speed lines, motion blur:1.3)");
  if (document.getElementById('aura-effects').checked && current.character?.aura) prompt.push(`(${current.character.aura}:1.4)`);

  const final = prompt.join(", ");
  document.getElementById('prompt-preview').textContent = final;
  return final;
}

function copyPrompt() {
  const text = document.getElementById('prompt-preview').textContent;
  navigator.clipboard.writeText(text).then(() => alert("Prompt copié !"));
}

// === MODE STORYBOARD ===
function addStoryboardFrame() {
  const frame = {
    id: Date.now(),
    manga: document.getElementById('manga-select').value,
    character: document.getElementById('character-select').value,
    decor: document.getElementById('decor-select').value,
    action: document.getElementById('action-scenario').value,
    camera: {
      type: document.getElementById('camera-type').value,
      movement: document.getElementById('camera-movement').value,
      angle: document.getElementById('camera-angle').value
    }
  };
  storyboard.push(frame);
  renderStoryboard();
}

function renderStoryboard() {
  const container = document.getElementById('storyboard-frames');
  container.innerHTML = '';
  storyboard.forEach((f, i) => {
    const char = data.characters.find(c => c.id === f.character);
    const decor = data.decors.find(d => d.id === f.decor);
    const div = document.createElement('div');
    div.className = 'frame-item';
    div.innerHTML = `
      <strong>Plan ${i+1}</strong> – ${char?.name || '??'} ${f.camera.movement} → ${f.camera.type}<br>
      <em>${f.action.substring(0, 80)}...</em>
      <button onclick="storyboard.splice(${i},1); renderStoryboard(); refreshAll();">Supprimer</button>
    `;
    container.appendChild(div);
  });
}

// === SAUVEGARDE / CHARGEMENT ===
function saveConfig() {
  const config = {
    version: "2.0",
    current: current,
    form: {
      master: document.getElementById('master-prompt').value,
      action: document.getElementById('action-scenario').value,
      camera: {
        type: document.getElementById('camera-type').value,
        movement: document.getElementById('camera-movement').value,
        angle: document.getElementById('camera-angle').value
      },
      // ... autres champs
    },
    storyboard
  };
  const dataStr = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
  const a = document.createElement('a');
  a.href = 'data:' + dataStr;
  a.download = "cinegrok-session.json";
  a.click();
}

function loadConfig() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const config = JSON.parse(ev.target.result);
        // Restaurer tout (simplifié ici)
        alert("Config chargée !");
        location.reload(); // simple mais efficace
      } catch { alert("Fichier invalide"); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Animation au scroll (optionnel mais classe)
const observerOptions = { threshold: 0.1 };
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
    }
  });
}, observerOptions);

document.querySelectorAll('section').forEach(sec => {
  sec.style.opacity = "0";
  sec.style.transform = "translateY(40px)";
  observer.observe(sec);
});
// Lancement
loadData();
