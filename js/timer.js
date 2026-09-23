/* Pomodoro timer */
let S={mode:'focus',dur:{focus:25*60,short:5*60,long:15*60},remaining:25*60,running:false,endAt:0,timerId:null,cycle:0,startedAt:null,taskId:null,project:'Estudio'};
const CIRC=2*Math.PI*132;

async function initTimer(){
  await window.PomoDB.initDB();
  const st=await window.PomoDB.getAllSettings();
  S.dur={focus:(st.focus_min??25)*60,short:(st.short_min??5)*60,long:(st.long_min??15)*60};
  S.taskId=st.current_task||null;
  S.project=localStorage.getItem('pomojd-project')||'Estudio';
  S.remaining=S.dur[S.mode];
  bindTimerUI();
  await refreshTaskSelect();
  await refreshToday();
  render();
}
function bindTimerUI(){
  document.querySelectorAll('.mode-tabs button').forEach(b=>b.onclick=()=>switchMode(b.dataset.mode));
  document.getElementById('startBtn').onclick=startPause;
  document.getElementById('resetBtn').onclick=resetTimer;
  document.getElementById('skipBtn').onclick=skip;
  document.getElementById('taskSelect').onchange=async e=>{
    S.taskId=e.target.value||null;
    await window.PomoDB.setSetting('current_task',S.taskId);
    const t=e.target.selectedOptions[0];
    if(t&&t.dataset.project){S.project=t.dataset.project;localStorage.setItem('pomojd-project',S.project);}
    toast('Tarea actualizada');
  };
  document.getElementById('projectSelect').onchange=e=>{S.project=e.target.value;localStorage.setItem('pomojd-project',S.project);};
  document.addEventListener('keydown',e=>{
    if(e.code==='Space'&&e.target.tagName!=='INPUT'&&e.target.tagName!=='TEXTAREA'){e.preventDefault();startPause();}
  });
}
function switchMode(mode){
  pauseTick();
  S.mode=mode;S.running=false;S.remaining=S.dur[mode];
  document.querySelectorAll('.mode-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  document.querySelector('.ring')?.classList.toggle('break',mode!=='focus');
  render();
}
function startPause(){
  if(S.running){pauseTick();S.running=false;}
  else{
    if(!S.startedAt) S.startedAt=Date.now();
    S.running=true;S.endAt=Date.now()+S.remaining*1000;
    S.timerId=setInterval(tick,250);
    if(S.mode==='focus') notifySilent('¡Enfoque iniciado! 🎯');
  }
  render();
}
function pauseTick(){if(S.timerId)clearInterval(S.timerId);S.timerId=null;if(S.running){S.remaining=Math.max(0,Math.round((S.endAt-Date.now())/1000));}}
function resetTimer(){pauseTick();S.running=false;S.remaining=S.dur[S.mode];S.startedAt=null;render();}
async function skip(){
  pauseTick();S.running=false;
  await saveSession(false);
  nextMode(true);
}
function tick(){
  S.remaining=Math.max(0,Math.round((S.endAt-Date.now())/1000));
  render();
  if(S.remaining<=0) complete();
}
async function complete(){
  pauseTick();S.running=false;
  await saveSession(true);
  const sound=await window.PomoDB.getSetting('sound',true);
  if(sound) window.PomoUI.beep(S.mode==='focus'?880:520,.25,S.mode==='focus'?3:2);
  if(navigator.vibrate) navigator.vibrate(200);
  if(S.mode==='focus'){
    S.cycle++;
    await window.PomoUI.notify('¡Pomodoro completado! 🎉','Tómate un descanso.');
    if(S.taskId){
      const tasks=await window.PomoDB.getTasks();
      const t=tasks.find(x=>x.id===S.taskId);
      if(t) await window.PomoDB.updateTask(S.taskId,{completed_pomos:(t.completed_pomos||0)+1});
    }
  } else {
    await window.PomoUI.notify('Descanso terminado','¡De vuelta al foco!');
  }
  await refreshToday();
  const st=await window.PomoDB.getAllSettings();
  const autoBreak=st.auto_start_break,autoFocus=st.auto_start_focus;
  const nextIsBreak=(S.mode==='focus');
  nextMode(false);
  if((nextIsBreak&&autoBreak)||(!nextIsBreak&&autoFocus)){
    setTimeout(()=>{startPause();},1500);
    toast('Auto-inicio en 1.5s…');
  }
}
function nextMode(manual){
  if(S.mode==='focus'){
    const needLong=(S.cycle%4===0&&S.cycle>0)||(manual&&false);
    // si completó 4 focus -> long
    const c=S.cycle;
    switchMode(c>0&&c%4===0?'long':'short');
  } else {
    switchMode('focus');
  }
  S.startedAt=null;
}
async function saveSession(completed){
  const now=Date.now();
  const start=S.startedAt||(now-(S.dur[S.mode]-S.remaining)*1000);
  const durMin=Math.round(S.dur[S.mode]/60);
  const actualMin=Math.max(.1,Math.round(((now-start)/60000)*10)/10);
  if(S.mode==='focus'&&actualMin<1&&!completed) {S.startedAt=null;return;}
  await window.PomoDB.addSession({
    type:S.mode,project:S.project||'Estudio',taskId:S.taskId,
    duration_min:durMin,actual_min:completed?durMin:actualMin,
    startedAt:start,endedAt:now,completed
  });
  // sync a cloudflare si existe endpoint
  try{
    if(navigator.onLine) fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:S.mode,project:S.project,taskId:S.taskId,duration_min:durMin,actual_min:completed?durMin:actualMin,startedAt:start,endedAt:now,completed})}).catch(()=>{});
  }catch{}
  S.startedAt=null;
}
function render(){
  const m=Math.floor(S.remaining/60),s=S.remaining%60;
  const t=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  document.getElementById('timerTime').textContent=t;
  document.title=`${t} • PomoJd`;
  const label={focus:'Enfoque',short:'Descanso corto',long:'Descanso largo'}[S.mode];
  document.getElementById('timerLabel').textContent=label+(S.running?' • en curso':'');
  document.getElementById('startBtn').textContent=S.running?'⏸ Pausar':'▶ Iniciar';
  const total=S.dur[S.mode]||1;
  const prog=1-(S.remaining/total);
  const ring=document.getElementById('ringProg');
  if(ring) ring.style.strokeDashoffset=String(CIRC*(1-prog));
  const dots=document.getElementById('cycleDots');
  if(dots){
    dots.innerHTML='';
    for(let i=0;i<4;i++){const d=document.createElement('span');if(i<(S.cycle%4))d.className='done';dots.appendChild(d);}
  }
}
async function refreshTaskSelect(){
  const sel=document.getElementById('taskSelect');
  const projSel=document.getElementById('projectSelect');
  const tasks=await window.PomoDB.getTasks({done:false});
  const projects=await window.PomoDB.getProjects();
  if(projSel){
    projSel.innerHTML=projects.map(p=>`<option ${p.name===S.project?'selected':''} value="${p.name}">${p.name}</option>`).join('')||`<option>Estudio</option>`;
  }
  if(sel){
    sel.innerHTML=`<option value="">— Sin tarea —</option>`+tasks.map(t=>`<option value="${t.id}" data-project="${t.project}" ${t.id===S.taskId?'selected':''}>${t.title} (${t.completed_pomos||0}/${t.estimated_pomos||4})</option>`).join('');
  }
}
async function refreshToday(){
  const stats=await window.PomoDB.getStats();
  const el=document.getElementById('todayCount');
  if(el) el.textContent=`Hoy: ${stats.todayPomos} pomodoros • ${stats.todayMin} min • Racha ${stats.streak}🔥`;
  const goal=await window.PomoDB.getSetting('daily_goal',8);
  const pct=Math.min(100,Math.round(stats.todayPomos/goal*100));
  const bar=document.getElementById('goalBar');
  if(bar) bar.style.width=pct+'%';
  const txt=document.getElementById('goalText');
  if(txt) txt.textContent=`${stats.todayPomos}/${goal} pomodoros (${pct}%)`;
}
function notifySilent(m){toast(m);}
window.PomoTimer={initTimer};
