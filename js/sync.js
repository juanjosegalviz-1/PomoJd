/* Sincronización nube: sube lo local, baja lo del servidor. El servidor manda por updated_at. */
const SYNC_KEY = 'pomojd-last-pull';
let _pushTimer = null;

function lastPull(){ return parseInt(localStorage.getItem(SYNC_KEY) || '0', 10) || 0; }
function setLastPull(t){ localStorage.setItem(SYNC_KEY, String(t)); }

async function fullSync(){
  const user = await window.PomoAuth.me();
  if(!user) return { ok: false, reason: 'no-auth' };
  // 1. subir todo lo local
  await pushAll();
  // 2. bajar novedades del servidor
  const r = await fetch('/api/sync/pull?since=' + lastPull(), { credentials: 'same-origin' });
  const j = await r.json();
  if(!j.ok) throw new Error(j.error || 'Fallo al bajar');
  await window.PomoDB.initDB();
  for(const s of (j.sessions || [])){
    await window.PomoDB.putSession({ ...s, completed: !!s.completed });
  }
  for(const t of (j.tasks || [])){
    await window.PomoDB.putTask({ ...t, done: !!t.done });
  }
  for(const s of (j.settings || [])){
    const cur = await window.PomoDB.getSetting(s.key, null);
    await window.PomoDB.setSetting(s.key, parseVal(s.value, cur));
  }
  setLastPull(j.server_time || Date.now());
  try{
    const { toast } = window.PomoUI;
    if(toast && ((j.sessions||[]).length || (j.tasks||[]).length)) toast('Nube al día.');
  }catch{}
  return { ok: true, running: j.running || null, server_time: j.server_time };
}
function parseVal(v, cur){
  if(typeof cur === 'boolean') return v === 'true';
  if(typeof cur === 'number'){ const n = Number(v); return Number.isFinite(n) ? n : cur; }
  return v;
}
async function pushAll(){
  const user = window.PomoAuth.user;
  if(!user) return;
  await window.PomoDB.initDB();
  const sessions = await window.PomoDB.getSessions({ limit: 5000 });
  const tasks = await window.PomoDB.getTasks();
  const settingsRaw = await window.PomoDB.getAllSettings();
  const settings = {};
  for(const [k, v] of Object.entries(settingsRaw)){
    if(k === 'current_task') continue;
    settings[k] = String(v);
  }
  const r = await fetch('/api/sync/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify({ sessions, tasks, settings, settings_updated_at: Date.now() }) });
  const j = await r.json().catch(()=>({ok:false}));
  if(!j.ok && j.need_auth){ await window.PomoAuth.me(true); }
  return j;
}
// subida diferida tras cambios locales (2s), solo con sesión y red
function schedulePush(){
  if(_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(()=>{ if(navigator.onLine && window.PomoAuth.user) pushAll().catch(()=>{}); }, 2000);
}
window.PomoSync = { fullSync, pushAll, schedulePush, lastPull };
