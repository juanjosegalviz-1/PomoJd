/* UI: negro por defecto, toasts, sonido, avisos */
function toast(msg){
  const c=document.getElementById('toasts');
  if(!c) return;
  const el=document.createElement('div');el.className='toast';el.textContent=msg;el.setAttribute('role','status');
  c.appendChild(el);setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300)},3800);
}
async function initTheme(){
  // La app es negra por decisión de diseño. Se respeta lo guardado, o negro.
  let saved=null;
  try{ saved=localStorage.getItem('pomojd-theme') || await window.PomoDB?.getSetting('theme','dark').catch(()=> 'dark'); }catch{ saved='dark'; }
  if(saved!=='dark'&&saved!=='light') saved='dark';
  document.documentElement.setAttribute('data-theme',saved);
  if(document.body) document.body.setAttribute('data-theme',saved);
}
async function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',cur);
  if(document.body) document.body.setAttribute('data-theme',cur);
  try{localStorage.setItem('pomojd-theme',cur);await window.PomoDB.setSetting('theme',cur);}catch{}
}
function beep(freq=880,dur=.25,times=2){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx) return;
    const ctx=new Ctx();
    let t=ctx.currentTime;
    for(let i=0;i<times;i++){
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.frequency.value=freq;g.gain.value=.16;
      o.start(t+i*.34);o.stop(t+i*.34+dur);
    }
  }catch{}
}
async function notify(title,body){
  try{
    const enabled=await window.PomoDB.getSetting('notifications',true);
    if(!enabled){toast(title);return;}
    if('Notification' in window){
      if(Notification.permission==='default') await Notification.requestPermission().catch(()=>{});
      if(Notification.permission==='granted'){new Notification(title,{body});return;}
    }
  }catch{}
  toast(title);
}
function setActiveNav(page){
  document.querySelectorAll('.sidebar .nav-link, .tabbar a').forEach(a=>{
    if(a.dataset.page===page) a.classList.add('active');
    else a.classList.remove('active');
  });
}
window.PomoUI={toast,initTheme,toggleTheme,beep,notify,setActiveNav};
document.addEventListener('DOMContentLoaded',()=>{window.PomoUI.initTheme();});
