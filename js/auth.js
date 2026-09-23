/* Cuenta + sesión */
let _me = undefined; // undefined = sin cargar, null = fuera, obj = dentro
async function me(force){
  if(_me !== undefined && !force) return _me;
  try{
    const r = await fetch('/api/auth/me', {credentials: 'same-origin'});
    const j = await r.json();
    _me = (j.ok && j.user) ? j.user : null;
  }catch{ _me = null; }
  updateAccountUI();
  return _me;
}
async function register(name, email, password){
  const r = await fetch('/api/auth/register', {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify({name, email, password})});
  const j = await r.json();
  if(!j.ok) throw new Error(j.error || 'No se pudo crear la cuenta');
  _me = j.user; updateAccountUI();
  return j.user;
}
async function login(email, password){
  const r = await fetch('/api/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify({email, password})});
  const j = await r.json();
  if(!j.ok) throw new Error(j.error || 'No se pudo entrar');
  _me = j.user; updateAccountUI();
  return j.user;
}
async function logout(){
  try{ await fetch('/api/auth/logout', {method:'POST', credentials:'same-origin'}); }catch{}
  _me = null; updateAccountUI();
}
function updateAccountUI(){
  document.querySelectorAll('[data-account]').forEach(el=>{
    if(_me){
      el.innerHTML = `<a href="cuenta.html" title="Tu cuenta">● ${escapeName(_me.name)}</a>`;
    } else if(_me === null){
      el.innerHTML = `<a class="btn btn-ghost" href="cuenta.html">Entrar</a>`;
    }
  });
  const badge = document.getElementById('syncBadge');
  if(badge) badge.textContent = _me ? `nube · ${_me.name}` : 'solo este aparato';
}
function escapeName(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
window.PomoAuth = { me, register, login, logout, get user(){ return _me || null; } };
document.addEventListener('DOMContentLoaded', ()=>{ window.PomoAuth.me(); });
