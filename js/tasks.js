/* Tasks page */
async function init(){
  await window.PomoDB.initDB();
  const projects=await window.PomoDB.getProjects();
  const newProj=document.getElementById('newProject');
  const filt=document.getElementById('filterProject');
  newProj.innerHTML=projects.map(p=>`<option>${p.name}</option>`).join('');
  filt.innerHTML=`<option value="">Todos los proyectos</option>`+projects.map(p=>`<option>${p.name}</option>`).join('');
  document.getElementById('addBtn').onclick=add;
  document.getElementById('newTitle').addEventListener('keydown',e=>{if(e.key==='Enter')add();});
  filt.onchange=render;document.getElementById('clearDone').onclick=async()=>{
    const done=await window.PomoDB.getTasks({done:true});
    for(const t of done) await window.PomoDB.deleteTask(t.id);
    toast('Completadas eliminadas');render();
  };
  render();
}
async function add(){
  const title=document.getElementById('newTitle').value.trim();
  if(!title) return toast('Escribe un título');
  await window.PomoDB.addTask({title,project:document.getElementById('newProject').value,estimated_pomos:parseInt(document.getElementById('newEst').value)||4});
  document.getElementById('newTitle').value='';
  toast('Tarea creada ✅');render();
}
async function render(){
  const f=document.getElementById('filterProject').value;
  const tasks=await window.PomoDB.getTasks(f?{project:f}:{});
  const list=document.getElementById('taskList');
  if(!tasks.length){list.innerHTML=`<div class="card" style="text-align:center;color:var(--text-muted)">Sin tareas. ¡Crea la primera arriba! 🚀</div>`;return;}
  list.innerHTML='';
  tasks.forEach(t=>{
    const d=document.createElement('div');d.className='task-item'+(t.done?' done':'');
    d.innerHTML=`<input type="checkbox" ${t.done?'checked':''} style="width:20px;height:20px"><div style="flex:1"><strong>${escapeHtml(t.title)}</strong><div style="font-size:.8rem;color:var(--text-muted)">${t.project} • ${t.completed_pomos||0}/${t.estimated_pomos||4} 🍅</div><div class="progress" style="margin-top:6px"><div style="width:${Math.min(100,((t.completed_pomos||0)/(t.estimated_pomos||4)*100))}%"></div></div></div><button class="btn btn-ghost" data-act="focus">▶</button><button class="btn btn-ghost" data-act="del">🗑</button>`;
    d.querySelector('input').onchange=async e=>{await window.PomoDB.updateTask(t.id,{done:e.target.checked});render();};
    d.querySelector('[data-act="del"]').onclick=async()=>{await window.PomoDB.deleteTask(t.id);toast('Eliminada');render();};
    d.querySelector('[data-act="focus"]').onclick=async()=>{await window.PomoDB.setSetting('current_task',t.id);localStorage.setItem('pomojd-project',t.project);toast('Enfocando: '+t.title);location.href='index.html';};
    list.appendChild(d);
  });
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
window.PomoTasks={init};
