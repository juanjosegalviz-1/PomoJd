/* Stats */
async function init(){
  await window.PomoDB.initDB();
  const stats=await window.PomoDB.getStats();
  document.getElementById('statCards').innerHTML=`
    <div class="card stat-card"><p class="num">${stats.todayPomos} 🍅</p><p class="lbl">Hoy (${stats.todayMin} min)</p></div>
    <div class="card stat-card"><p class="num">${stats.weekPomos} 🍅</p><p class="lbl">Últimos 7 días (${stats.weekMin} min)</p></div>
    <div class="card stat-card"><p class="num">${stats.streak} 🔥</p><p class="lbl">Racha días</p></div>
    <div class="card stat-card"><p class="num">${Math.round(stats.weekMin/60*10)/10}h</p><p class="lbl">Foco total semana</p></div>`;
  const max=Math.max(1,...stats.byDay.map(d=>d.pomos));
  document.getElementById('bars').innerHTML=stats.byDay.map(d=>`<div class="bar"><div class="bar-fill" title="${d.pomos} pomos" style="height:${Math.max(4,d.pomos/max*140)}px"></div><span>${d.label}</span><strong style="font-size:.8rem">${d.pomos}</strong></div>`).join('');
  const projEntries=Object.entries(stats.byProject).sort((a,b)=>b[1].min-a[1].min);
  document.getElementById('byProj').innerHTML=projEntries.length?projEntries.map(([k,v])=>`<div style="margin-bottom:10px"><div class="row" style="justify-content:space-between"><strong>${k}</strong><small>${v.pomos} 🍅 • ${v.min} min</small></div><div class="progress" style="margin-top:6px"><div style="width:${Math.min(100,v.min/Math.max(1,stats.weekMin)*100)}%"></div></div></div>`).join(''):'<p style="color:var(--text-muted)">Sin datos aún.</p>';
  const hist=document.getElementById('hist');
  hist.innerHTML=stats.all.slice(0,100).map(s=>`<tr><td>${new Date(s.startedAt).toLocaleString('es')}</td><td><span class="badge ${s.type}">${s.type}</span></td><td>${s.project}</td><td>${s.actual_min??s.duration_min}</td><td>${s.completed?'✅':'⚠️ parcial'}</td></tr>`).join('')||'<tr><td colspan=5>Sin sesiones</td></tr>';
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
