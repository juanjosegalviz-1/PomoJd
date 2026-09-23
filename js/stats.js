/* Stats */
async function init(){
  await window.PomoDB.initDB();
  const stats=await window.PomoDB.getStats();
  const todayK=window.PomoDB.dayKey(Date.now());
  document.getElementById('statCards').innerHTML=`
    <div class="card stat-card"><p class="num">${stats.todayPomos} <small>focos</small></p><p class="lbl">Hoy · ${stats.todayMin} min</p></div>
    <div class="card stat-card"><p class="num">${stats.weekPomos} <small>focos</small></p><p class="lbl">7 días · ${stats.weekMin} min</p></div>
    <div class="card stat-card streak"><p class="num">${stats.streak} <small>días</small></p><p class="lbl">Seguidos sin fallar</p></div>
    <div class="card stat-card"><p class="num">${Math.round(stats.weekMin/60*10)/10}<small> h</small></p><p class="lbl">Foco total semana</p></div>`;
  const max=Math.max(1,...stats.byDay.map(d=>d.pomos));
  document.getElementById('bars').innerHTML=stats.byDay.map(d=>`<div class="bar${d.key===todayK?' today':''}"><div class="bar-fill" title="${d.pomos} focos" style="height:${Math.max(5,d.pomos/max*140)}px"></div><span>${d.label}</span><strong>${d.pomos}</strong></div>`).join('');
  const projEntries=Object.entries(stats.byProject).sort((a,b)=>b[1].min-a[1].min);
  document.getElementById('byProj').innerHTML=projEntries.length?projEntries.map(([k,v])=>`<div style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><strong style="font-weight:500">${k}</strong><small class="today-line">${v.pomos} focos · ${v.min} min</small></div><div class="progress" style="margin-top:7px"><div style="width:${Math.min(100,v.min/Math.max(1,stats.weekMin)*100)}%"></div></div></div>`).join(''):'<p class="foot-note">Aún no hay horas. Haz tu primer foco y vuelve.</p>';
  const hist=document.getElementById('hist');
  const typeName={focus:'foco',short:'pausa',long:'larga'};
  hist.innerHTML=stats.all.slice(0,100).map(s=>`<tr><td class="mono">${new Date(s.startedAt).toLocaleString('es',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td><td><span class="badge ${s.type}">${typeName[s.type]||s.type}</span></td><td>${s.project}</td><td class="mono">${s.actual_min??s.duration_min} min</td><td>${s.completed?'completo':'parcial'}</td></tr>`).join('')||'<tr><td colspan=5>Nada por aquí todavía.</td></tr>';
  document.getElementById('exportCsv').onclick=async()=>{
    const all=await window.PomoDB.getSessions({limit:5000});
    download('pomojd.csv',window.PomoDB.exportCSV(all),'text/csv');
  };
  document.getElementById('exportJson').onclick=async()=>{
    const all=await window.PomoDB.getSessions({limit:5000});
    download('pomojd.json',JSON.stringify(all,null,2),'application/json');
  };
  document.getElementById('clearBtn').onclick=async()=>{
    if(!confirm('¿Borrar todo el historial?')) return;
    await window.PomoDB.clearSessions();location.reload();
  };
}
function download(name,content,type){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();
}
window.PomoStats={init};
