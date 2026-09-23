/* UI helpers: theme, nav, toasts, sound, notify */
function toast(msg){
  const c=document.getElementById('toasts');
  if(!c) return alert(msg);
  const el=document.createElement('div');el.className='toast';el.textContent=msg;el.setAttribute('role','status');
  c.appendChild(el);setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300)},3800);
}
async function initTheme(){
  const saved=localStorage.getItem('pomojd-theme')||await window.PomoDB?.getSetting('theme','light').catch(()=> 'light')||'light';
  const prefersDark=matchMedia('(prefers-color-scheme: dark)').matches;
  const theme=saved||(prefersDark?'dark':'light');
  document.documentElement.setAttribute('data-theme',theme);
  document.body?.setAttribute('data-theme',theme);
  updateThemeBtn(theme);
}
function updateThemeBtn(theme){
  const b=document.getElementById('themeBtn');
  if(b) b.textContent=theme==='dark'?'☀️':'🌙';
}
async function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',cur);
  document.body?.setAttribute('data-theme',cur);
  localStorage.setItem('pomojd-theme',cur);
  try{await window.PomoDB.setSetting('theme',cur);}catch{}
  updateThemeBtn(cur);
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
      o.frequency.value=freq;g.gain.value=.18;
      o.start(t+i*.32);o.stop(t+i*.32+dur);
    }
  }catch{}
}
async function notify(title,body){
  try{
    const enabled=await window.PomoDB.getSetting('notifications',true);
    if(!enabled) return;
    if('Notification' in window){
      if(Notification.permission==='default') await Notification.requestPermission().catch(()=>{});
      if(Notification.permission==='granted') new Notification(title,{body});
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
