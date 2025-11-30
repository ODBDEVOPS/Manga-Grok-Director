let data = {}, storyboard = [];

async function init() {
  try {
    const [m,a,c,d,t] = await Promise.all([
      fetch('data/mangas.json').then(r=>r.json()),
      fetch('data/characters.json').then(r=>r.json()),
      fetch('data/decors.json').then(r=>r.json()),
      fetch('templates/presets.json').then(r=>r.json())
    ]);
    data.mangas = m.mangas; data.chars = a.characters; data.decors = c.decors; data.templates = t.templates;

    populate('manga-select', data.mangas, 'id', 'titre');
    populate('character-select', data.chars, 'id', 'name');
    populate('decor-select', data.decors, 'id', 'nom');
    populate('template-select', data.templates, 'id', 'name');

    setupEvents();
    updateNegative();
  } catch(e) { alert("Erreur chargement données"); console.error(e); }
}

function populate(id, arr, val, txt) {
  const sel = document.getElementById(id);
  sel.innerHTML = '<option value="">Choisir...</option>';
  arr.forEach(o => {
    const opt = new Option(o[txt], o[val]);
    sel.appendChild(opt);
  });
}

function getSel(id) { return document.getElementById(id).value; }
function getCheck(id) { return document.getElementById(id).checked; }

function setupEvents() {
  document.getElementById('manga-select').onchange = updateAll;
  document.getElementById('character-select').onchange = () => { current.char = data.chars.find(c=>c.id===getSel('character-select')); updateAll(); };
  document.getElementById('decor-select').onchange = () => { current.decor = data.decors.find(d=>d.id===getSel('decor-select')); updateAll(); };
  document.getElementById('template-select').onchange = applyTemplate;

  ['master-prompt','action-scenario','camera-type','camera-movement','camera-angle'].forEach(id => {
    document.getElementById(id).oninput = updateAll;
  });
  document.querySelectorAll('input[type=checkbox], input[type=range]').forEach(el => el.oninput = updateAll);

  document.getElementById('generate-btn').onclick = generateFinal;
  document.getElementById('copy-btn').onclick = () => navigator.clipboard.writeText(document.getElementById('prompt-preview').textContent).then(()=>alert("Copié !"));
  document.getElementById('add-frame').onclick = addFrame;
  document.getElementById('save-btn').onclick = saveSession;
  document.getElementById('load-btn').onclick = loadSession;
  document.getElementById('reset-btn').onclick = () => location.reload();

  document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById(t.dataset.tab).classList.add('active');
    updateAll();
  });

  document.getElementById('dramatic-slider').oninput = e => document.getElementById('dramatic-value').textContent = e.target.value;
  document.getElementById('fidelity-slider').oninput = e => document.getElementById('fidelity-value').textContent = e.target.value;
}

let current = {manga:null, char:null, decor:null};

function updateAll() {
  current.manga = data.mangas.find(m=>m.id===getSel('manga-select')) || null;
  updateCompat();
  generatePrompt();
}

function updateCompat() {
  const cc = document.getElementById('char-compat');
  const dc = document.getElementById('decor-compat');
  cc.textContent = current.char && current.manga && current.char.manga===current.manga.id ? 'Valid' : 'Warning';
  dc.textContent = current.decor && current.manga && current.decor.manga_compatible.includes(current.manga.id) ? 'Valid' : 'Warning';
}

function applyTemplate() {
  const t = data.templates.find(x=>x.id===getSel('template-select'));
  if(!t) return;
  document.getElementById('action-scenario').value = t.action;
  document.getElementById('camera-type').value = t.camera.type;
  document.getElementById('camera-movement').value = t.camera.movement;
  document.getElementById('camera-angle').value = t.camera.angle;
  document.getElementById('dramatic-slider').value = t.dramatic||75;
  document.getElementById('dramatic-value').textContent = t.dramatic||75;
  generatePrompt();
}

function generatePrompt() {
  let p = [];
  const master = document.getElementById('master-prompt').value.trim() || 
    (current.manga ? `8K, masterpiece, ${current.manga.prompt_style}, cinematic lighting` : "8K anime style");
  p.push(master);

  if(current.char){
    p.push(`(${current.char.name}:1.4), ${current.char.prompt_base}`);
    if(getCheck('keep-appearance')) p.push("(exact likeness:1.5)");
  }
  const action = document.getElementById('action-scenario').value.trim();
  if(action) p.push(action);
  if(current.decor) p.push(current.decor.prompt_environnement, `${current.decor.scene.moment}, ${current.decor.scene.meteo}`);
  p.push(document.getElementById('camera-type').value);
  p.push(document.getElementById('camera-movement').value.toLowerCase());
  p.push(document.getElementById('camera-angle').value.toLowerCase()+" angle");

  if(getCheck('speed-lines')) p.push("(speed lines, motion blur:1.3)");
  if(getCheck('aura-effects') && current.char?.aura) p.push(`(${current.char.aura}:1.4)`);

  );

  document.getElementById('prompt-preview').textContent = p.join(", ");
}

function generateFinal(){ generatePrompt(); alert("Prompt généré !"); }

function addFrame(){
  storyboard.push({
    manga: getSel('manga-select'),
    char: getSel('character-select'),
    decor: getSel('decor-select'),
    action: document.getElementById('action-scenario').value,
    camera: {
      type: document.getElementById('camera-type').value,
      movement: document.getElementById('camera-movement').value,
      angle: document.getElementById('camera-angle').value
    }
  });
  renderStoryboard();
}

function renderStoryboard(){
  const list = document.getElementById('frames-list');
  list.innerHTML = '';
  storyboard.forEach((f,i)=>{
    const c = data.chars.find(x=>x.id===f.char)?.name || '??';
    const el = document.createElement('div');
    el.className='frame';
    el.innerHTML = `<strong>Plan ${i+1}</strong> — ${c}<br>${f.action.slice(0,70)}...<button>X</button>`;
    el.querySelector('button').onclick = ()=>{ storyboard.splice(i,1); renderStoryboard(); };
    list.appendChild(el);
  });
}

function updateNegative(){
  document.getElementById('negative-preview').textContent =
    "blurry, low quality, deformed, bad anatomy, extra limbs, bad hands, watermark, text, error, worst quality, jpeg artifacts";
}

function saveSession(){
  const blob = new Blob([JSON.stringify({current, storyboard, form:{
    master:document.getElementById('master-prompt').value,
    action:document.getElementById('action-scenario').value
  }},null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='cinegrok-session.json'; a.click();
}

function loadSession(){
  const input = document.createElement('input'); input.type='file'; input.accept='.json';
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = ev => {
      try{
        const d = JSON.parse(ev.target.result);
        // restauration simplifiée — recharge la page après sauvegarde si besoin
        alert("Session chargée ! Recharger la page pour tout restaurer.");
      }catch{alert("Fichier invalide");}
    };
    reader.readAsText(file);
  };
  input.click();
}

init();
