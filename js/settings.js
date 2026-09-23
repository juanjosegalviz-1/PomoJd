/* Settings */
async function init(){
  await window.PomoDB.initDB();
  const s=await window.PomoDB.getAllSettings();
  document.getElementById('focusMin').value=s.focus_min??25;
  document.getElementById('shortMin').value=s.short_min??5;
  document.getElementById('longMin').value=s.long_min??15;
  document.getElementById('dailyGoal').value=s.daily_goal??8;
  const defs=[['sound','Sonido de aviso','Marca el fin de cada bloque'],['notifications','Notificaciones','Aviso del sistema al terminar'],['auto_start_break','Auto-iniciar pausas','Encadena el descanso sin pulsar nada'],['auto_start_focus','Auto-iniciar foco','Vuelve al foco solo tras la pausa']];
  const box=document.getElementById('toggles');box.innerHTML='';
  for(const [k,label,desc] of defs){
    const row=document.createElement('div');row.className='setting-row';
    row.innerHTML=`<div><div class="s-t">${label}</div><div class="s-d">${desc}</div></div>`;
    const btn=document.createElement('button');btn.className='toggle';btn.setAttribute('aria-checked',String(!!s[k]));btn.setAttribute('aria-label',label);
    btn.onclick=async()=>{const v=btn.getAttribute('aria-checked')!=='true';btn.setAttribute('aria-checked',String(v));await window.PomoDB.setSetting(k,v);toast('Guardado');};
    row.appendChild(btn);box.appendChild(row);
  }
  document.getElementById('saveTimes').onclick=async()=>{
    await window.PomoDB.setSetting('focus_min',parseInt(document.getElementById('focusMin').value)||25);
    await window.PomoDB.setSetting('short_min',parseInt(document.getElementById('shortMin').value)||5);
    await window.PomoDB.setSetting('long_min',parseInt(document.getElementById('longMin').value)||15);
    await window.PomoDB.setSetting('daily_goal',parseInt(document.getElementById('dailyGoal').value)||8);
    toast('Guardado.');
  };
  document.getElementById('expJson').onclick=async()=>{
    const all=await window.PomoDB.getSessions({limit:5000});
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(all,null,2)],{type:'application/json'}));a.download='pomojd.json';a.click();
  };
  document.getElementById('wipe').onclick=async()=>{
    if(!confirm('¿Borrar sesiones y tareas?')) return;
    await window.PomoDB.clearSessions();
    const tasks=await window.PomoDB.getTasks();
    for(const t of tasks) await window.PomoDB.deleteTask(t.id);
    toast('Datos borrados'); 
  };
}
window.PomoSettings={init};
