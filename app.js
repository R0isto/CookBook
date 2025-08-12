// Final app script: IndexedDB storage, image compression, delete, backup, search, sort, PWA registration.
// (This is the updated version with overlay / menu fixes)

const DB_NAME = 'cookbook-db';
const STORE_NAME = 'recipes';
const DB_VERSION = 1;
const MAX_IMAGE_DIM = 1200; // px
const IMAGE_QUALITY = 0.8; // JPEG quality

// Simple IDB helper (promise-based)
function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains(STORE_NAME)){
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function idbGetAll(){
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  }));
}

function idbPut(item){
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}

function idbDelete(id){
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  }));
}

function idbClear(){
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  }));
}

// Utils
const el = id => document.getElementById(id);
const qsa = sel => document.querySelectorAll(sel);
const uuid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

function showToast(msg, timeout=2200){
  const t = el('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('visible');
  setTimeout(()=>{ t.classList.remove('visible'); t.classList.add('hidden'); }, timeout);
}

// Overlay helpers: show/hide overlay and prevent background scroll
function showOverlay(){
  const overlay = el('overlay');
  if(!overlay) return;
  overlay.classList.remove('hidden');
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function hideOverlay(){
  const overlay = el('overlay');
  if(!overlay) return;
  overlay.classList.remove('visible');
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}
// Clicking the overlay closes menus and modals
document.addEventListener('click', (e)=>{
  const overlay = el('overlay');
  if(!overlay) return;
  if(e.target === overlay){
    const side = el('sideMenu');
    if(side && side.classList.contains('open')) side.classList.remove('open');
    // hide modals
    const detail = el('detailModal'), form = el('formModal'), confirm = el('confirmModal');
    if(detail) detail.classList.add('hidden');
    if(form) form.classList.add('hidden');
    if(confirm) confirm.classList.add('hidden');
    hideOverlay();
  }
});

// Image resize & compress: returns dataURL
function resizeImageFile(file, maxDim=MAX_IMAGE_DIM, quality=IMAGE_QUALITY){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          const ratio = width/height;
          if(width > height){ width = maxDim; height = Math.round(maxDim/ratio); } else { height = maxDim; width = Math.round(maxDim*ratio); }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // convert to jpeg to reduce size
        const dataURL = canvas.toDataURL('image/jpeg', quality);
        resolve(dataURL);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// App state
let recipes = [];

// Theme apply
function applyTheme(section){
  document.body.setAttribute('data-section', section);
  qsa('.side-menu li').forEach(li=> li.classList.toggle('active', li.dataset.section===section));
}

// Render
function renderCards(filter='all', query='', sortBy='updated'){
  const container = el('cards');
  container.innerHTML = '';
  let items = recipes.slice();
  if(filter !== 'all') items = items.filter(r=> r.section === filter);
  if(query) items = items.filter(r => (r.name||'').toLowerCase().includes(query.toLowerCase()));
  if(sortBy === 'name') items.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
  else items.sort((a,b)=> (b.updated||0) - (a.updated||0));
  if(items.length === 0){
    container.innerHTML = '<p style="opacity:.8">No recipes yet. Tap + to add one.</p>';
    return;
  }
  items.forEach(r=>{
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = r.id;
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.style.backgroundImage = r.photo ? `url(${r.photo})` : `linear-gradient(135deg, rgba(255,255,255,0.03), rgba(0,0,0,0.03))`;
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = r.name || 'Untitled';
    card.appendChild(thumb);
    card.appendChild(name);
    card.addEventListener('click', ()=> openDetail(r.id));
    container.appendChild(card);
  });
}

// Detail modal
function openDetail(id){
  const r = recipes.find(x=>x.id===id); if(!r) return;
  applyTheme(r.section || 'all');
  el('detailPhoto').style.backgroundImage = r.photo ? `url(${r.photo})` : 'none';
  el('detailTime').textContent = r.time || '';
  el('detailIngredients').textContent = r.ingredients || '';
  el('detailInstructions').textContent = r.instructions || '';
  el('detailNutrition').textContent = r.nutrition || '';
  el('detailModal').classList.remove('hidden');
  showOverlay();
  currentDetailId = id;
}

// Close modals
function closeDetail(){ el('detailModal').classList.add('hidden'); currentDetailId = null; hideOverlay(); }
function closeForm(){ el('formModal').classList.add('hidden'); el('recipeForm').reset(); el('editingId').value = ''; autoSaveDraft(); hideOverlay(); }

// Form open/edit
function openForm(id=null){
  el('formModal').classList.remove('hidden');
  showOverlay();
  if(id){
    const r = recipes.find(x=>x.id===id); if(!r) return;
    el('formTitle').textContent = 'Edit Recipe';
    el('name').value = r.name||'';
    el('time').value = r.time||'';
    el('ingredients').value = r.ingredients||'';
    el('instructions').value = r.instructions||'';
    el('nutrition').value = r.nutrition||'';
    el('sectionSelect').value = r.section||'all';
    el('editingId').value = r.id;
  } else {
    el('formTitle').textContent = 'Add Recipe';
    el('recipeForm').reset();
    el('editingId').value = '';
    const draft = localStorage.getItem('cookbook_draft');
    if(draft){
      try{ const d = JSON.parse(draft); el('name').value = d.name||''; el('time').value = d.time||''; el('ingredients').value = d.ingredients||''; el('instructions').value = d.instructions||''; el('nutrition').value = d.nutrition||''; el('sectionSelect').value = d.section||'all'; }catch(e){}
    }
  }
  applyTheme(el('sectionSelect').value || 'all');
}

// Delete
function deleteRecipe(id){
  showConfirm('Delete this recipe? This cannot be undone.', async () => {
    await idbDelete(id);
    recipes = recipes.filter(r=> r.id !== id);
    renderCards(currentFilter, currentSearch, currentSort);
    closeDetail();
    showToast('Recipe deleted');
  });
}

// Backup/export all
async function exportAll(){
  const data = await idbGetAll();
  const blob = new Blob([JSON.stringify(data,null,2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'cookbook-backup.json'; a.click();
  URL.revokeObjectURL(url);
}

// Confirm modal helper
function showConfirm(text, onYes){
  el('confirmText').textContent = text;
  showOverlay();
  el('confirmModal').classList.remove('hidden');
  const yes = el('confirmYes'), no = el('confirmNo');
  const cleanup = () => { el('confirmModal').classList.add('hidden'); yes.onclick = null; no.onclick = null; hideOverlay(); };
  yes.onclick = () => { cleanup(); onYes && onYes(); };
  no.onclick = () => { cleanup(); };
}

// Auto-save draft of form to localStorage
function autoSaveDraft(){
  const draft = {
    name: el('name')?.value || '',
    time: el('time')?.value || '',
    ingredients: el('ingredients')?.value || '',
    instructions: el('instructions')?.value || '',
    nutrition: el('nutrition')?.value || '',
    section: el('sectionSelect')?.value || 'all'
  };
  localStorage.setItem('cookbook_draft', JSON.stringify(draft));
}

// Load initial recipes from IDB
let currentFilter = 'all', currentSearch = '', currentSort = 'updated', currentDetailId = null;

async function loadAndRender(){
  try{
    recipes = await idbGetAll();
    renderCards(currentFilter, currentSearch, currentSort);
  }catch(e){
    console.error('Failed to load from IndexedDB, trying localStorage fallback', e);
    const backup = localStorage.getItem('cookbook_recipes_v2');
    recipes = backup ? JSON.parse(backup) : [];
    renderCards(currentFilter, currentSearch, currentSort);
  }
}

// Wiring
document.addEventListener('DOMContentLoaded', ()=>{
  const menuBtn = el('menuBtn'), side = el('sideMenu'), overlay = el('overlay');
  menuBtn.addEventListener('click', ()=>{ side.classList.toggle('open'); if(side.classList.contains('open')) showOverlay(); else hideOverlay(); });
  // overlay click handled globally by document click listener

  qsa('.side-menu li').forEach(li => {
    li.addEventListener('click', async ()=>{
      const s = li.dataset.section;
      if(!s) return;
      currentFilter = s;
      applyTheme(s);
      renderCards(currentFilter, currentSearch, currentSort);
      side.classList.remove('open');
      hideOverlay();
    });
  });

  el('addBtn').addEventListener('click', ()=> openForm());
  el('detailClose').addEventListener('click', closeDetail);
  el('formClose').addEventListener('click', closeForm);

  el('recipeForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const id = el('editingId').value || uuid();
    const file = el('photo').files[0];
    let photoData = null;
    if(file){
      try{ photoData = await resizeImageFile(file); }catch(e){ console.warn('Image resize failed', e); }
    }
    const existing = recipes.find(r=>r.id===id);
    if(!photoData && existing) photoData = existing.photo || null;

    const item = {
      id,
      name: el('name').value,
      time: el('time').value,
      ingredients: el('ingredients').value,
      instructions: el('instructions').value,
      nutrition: el('nutrition').value,
      photo: photoData,
      section: el('sectionSelect').value || 'all',
      updated: Date.now()
    };
    await idbPut(item);
    const idx = recipes.findIndex(r=>r.id===id);
    if(idx>-1) recipes[idx] = item; else recipes.unshift(item);
    try{ localStorage.setItem('cookbook_recipes_v2', JSON.stringify(recipes)); }catch(e){}
    renderCards(currentFilter, currentSearch, currentSort);
    closeForm();
    showToast('Saved');
  });

  el('exportBtn').addEventListener('click', async ()=>{
    const data = await idbGetAll();
    const blob = new Blob([JSON.stringify(data,null,2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cookbook-recipes.json'; a.click();
    URL.revokeObjectURL(url);
  });
  el('importBtn').addEventListener('click', ()=> el('importFile').click());
  el('importFile').addEventListener('change', (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = async () => {
      try{ const data = JSON.parse(r.result); if(Array.isArray(data)){
        for(const rec of data){ if(!rec.id) rec.id = uuid(); await idbPut(rec); }
        await loadAndRender();
        showToast('Imported '+data.length+' recipes');
      } else showToast('Invalid JSON'); }catch(err){ showToast('Import failed'); }
    };
    r.readAsText(f);
  });

  el('backupBtn').addEventListener('click', exportAll);
  el('clearBtn').addEventListener('click', ()=> showConfirm('Clear all recipes? This will delete everything locally.', async ()=>{ await idbClear(); recipes=[]; renderCards(currentFilter, currentSearch, currentSort); showToast('Cleared'); }));

  el('editFromDetail').addEventListener('click', ()=>{ if(currentDetailId) { openForm(currentDetailId); closeDetail(); } });
  el('deleteFromDetail').addEventListener('click', ()=>{ if(currentDetailId) deleteRecipe(currentDetailId); });

  el('searchInput').addEventListener('input', (e)=>{ currentSearch = e.target.value; renderCards(currentFilter, currentSearch, currentSort); });
  el('sortSelect').addEventListener('change', (e)=>{ currentSort = e.target.value; renderCards(currentFilter, currentSearch, currentSort); });

  ['name','time','ingredients','instructions','nutrition','sectionSelect'].forEach(id => {
    const node = el(id);
    if(node) node.addEventListener('input', autoSaveDraft);
  });

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/service-worker.js').then(()=>console.log('SW registered')).catch(()=>{});
  }

  loadAndRender();

});

