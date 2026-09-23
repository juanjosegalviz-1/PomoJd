/* PomoJd DB - IndexedDB wrapper */
const DB_NAME = 'pomojd-db';
const DB_VERSION = 1;
let _db = null;

function initDB(){
  if(_db) return Promise.resolve(_db);
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      if(!db.objectStoreNames.contains('sessions')){
        const s = db.createObjectStore('sessions',{keyPath:'id'});
        s.createIndex('by_startedAt','startedAt',{unique:false});
        s.createIndex('by_type','type',{unique:false});
        s.createIndex('by_project','project',{unique:false});
        s.createIndex('by_task','taskId',{unique:false});
      }
      if(!db.objectStoreNames.contains('tasks')){
        const t = db.createObjectStore('tasks',{keyPath:'id'});
        t.createIndex('by_project','project',{unique:false});
        t.createIndex('by_done','done',{unique:false});
      }
      if(!db.objectStoreNames.contains('projects')){
        const p = db.createObjectStore('projects',{keyPath:'id'});
        p.createIndex('by_name','name',{unique:true});
      }
      if(!db.objectStoreNames.contains('settings')){
        db.createObjectStore('settings',{keyPath:'key'});
      }
    };
    req.onsuccess = async (e)=>{
      _db = e.target.result;
      await seedDefaults();
      resolve(_db);
    };
    req.onerror = ()=>reject(req.error);
  });
}
function tx(store,mode='readonly'){
  return _db.transaction(store,mode).objectStore(store);
}
function reqToPromise(req){
  return new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});
}
const uid = ()=> (crypto.randomUUID ? crypto.randomUUID() : 'id-'+Date.now()+'-'+Math.random().toString(16).slice(2));

async function seedDefaults(){
  const defaults = {focus_min:25,short_min:5,long_min:15,cycles_until_long:4,auto_start_break:false,auto_start_focus:false,sound:true,notifications:true,daily_goal:8,theme:'light',current_task:null};
  for(const [k,v] of Object.entries(defaults)){
    const cur = await reqToPromise(tx('settings').get(k)).catch(()=>undefined);
    if(cur===undefined) await reqToPromise(tx('settings','readwrite').put({key:k,value:v})).catch(()=>{});
  }
  const projs = await reqToPromise(tx('projects').getAll()).catch(()=>[]);
  if(!projs || projs.length===0){
    for(const [name,color] of [['Estudio','#E5484D'],['Trabajo','#2563EB'],['Personal','#16A34A']]){
      await reqToPromise(tx('projects','readwrite').put({id:uid(),name,color,archived:false,createdAt:Date.now()})).catch(()=>{});
    }
  }
}

async function addSession(s){
  await initDB();
  const doc = {id:uid(),type:'focus',project:'general',taskId:null,duration_min:25,actual_min:25,startedAt:Date.now(),endedAt:Date.now(),completed:true,notes:'',updated_at:Date.now(),...s,updated_at:Date.now()};
  await reqToPromise(tx('sessions','readwrite').put(doc));
  try{ window.PomoSync && window.PomoSync.schedulePush(); }catch{}
  return doc.id;
}
async function putSession(doc){
  await initDB();
  if(!doc || !doc.id) return;
  await reqToPromise(tx('sessions','readwrite').put({...doc, updated_at: doc.updated_at || Date.now()}));
}
async function getSessions({from=0,to=Date.now(),type=null,project=null,limit=200}={}){
  await initDB();
  const all = await reqToPromise(tx('sessions').index('by_startedAt').getAll(IDBKeyRange.bound(from,to)));
  let f = (all||[]).sort((a,b)=>b.startedAt-a.startedAt);
  if(type) f=f.filter(s=>s.type===type);
  if(project) f=f.filter(s=>s.project===project);
  return f.slice(0,limit);
}
async function clearSessions(){await initDB();await reqToPromise(tx('sessions','readwrite').clear());}
async function addTask(t){
  await initDB();
  const doc={id:uid(),title:'Sin título',project:'general',estimated_pomos:4,completed_pomos:0,done:false,createdAt:Date.now(),updated_at:Date.now(),...t,updated_at:Date.now()};
  await reqToPromise(tx('tasks','readwrite').put(doc));
  try{ window.PomoSync && window.PomoSync.schedulePush(); }catch{}
  return doc.id;
}
async function putTask(doc){
  await initDB();
  if(!doc || !doc.id) return;
  await reqToPromise(tx('tasks','readwrite').put({...doc, updated_at: doc.updated_at || Date.now()}));
}
async function updateTask(id,patch){
  await initDB();
  const cur=await reqToPromise(tx('tasks').get(id));
  if(!cur) return;
  await reqToPromise(tx('tasks','readwrite').put({...cur,...patch,updated_at:Date.now()}));
  try{ window.PomoSync && window.PomoSync.schedulePush(); }catch{}
}
async function deleteTask(id){await initDB();await reqToPromise(tx('tasks','readwrite').delete(id));}
async function getTasks({project=null,done=null}={}){
  await initDB();
  let all=await reqToPromise(tx('tasks').getAll())||[];
  if(project) all=all.filter(t=>t.project===project);
  if(done!==null) all=all.filter(t=>t.done===done);
  return all.sort((a,b)=>b.createdAt-a.createdAt);
}
async function getProjects(){
  await initDB();
  return (await reqToPromise(tx('projects').getAll())||[]).sort((a,b)=>a.name.localeCompare(b.name));
}
async function getSetting(key,def){
  await initDB();
  const r=await reqToPromise(tx('settings').get(key)).catch(()=>undefined);
  return r===undefined?def:r.value;
}
async function setSetting(key,value){await initDB();await reqToPromise(tx('settings','readwrite').put({key,value}));try{ if(window.PomoSync && window.PomoAuth && window.PomoAuth.user && key!=='current_task') window.PomoSync.schedulePush(); }catch{}}
async function getAllSettings(){
  await initDB();
  const all=await reqToPromise(tx('settings').getAll())||[];
  const o={};all.forEach(r=>o[r.key]=r.value);return o;
}
function dayKey(ts=Date.now()){
  const d=new Date(ts);
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
async function getStats(){
  const now=new Date();now.setHours(0,0,0,0);
  const startToday=now.getTime();
  const startWeek=startToday-6*86400000;
  const sessions=await getSessions({from:startWeek});
  const focus=sessions.filter(s=>s.completed&&s.type==='focus');
  const today=focus.filter(s=>s.startedAt>=startToday);
  const todayMin=Math.round(today.reduce((a,s)=>a+(s.actual_min||s.duration_min||0),0));
  const weekMin=Math.round(focus.reduce((a,s)=>a+(s.actual_min||s.duration_min||0),0));
  // racha
  let streak=0;
  for(let i=0;i<30;i++){
    const d=new Date(startToday-i*86400000);
    const k=dayKey(d.getTime());
    const has=focus.some(s=>dayKey(s.startedAt)===k);
    if(has) streak++; else if(i===0) continue; else break;
  }
  // por día 7 días
  const byDay=[];
  for(let i=6;i>=0;i--){
    const d=new Date(startToday-i*86400000);
    const k=dayKey(d.getTime());
    const list=focus.filter(s=>dayKey(s.startedAt)===k);
    byDay.push({key:k,label:d.toLocaleDateString('es',{weekday:'short'}),pomos:list.length,min:Math.round(list.reduce((a,s)=>a+(s.actual_min||0),0))});
  }
  const byProject={};
  focus.forEach(s=>{byProject[s.project]=byProject[s.project]||{pomos:0,min:0};byProject[s.project].pomos++;byProject[s.project].min+=Math.round(s.actual_min||s.duration_min||0);});
  return {todayPomos:today.length,todayMin,weekPomos:focus.length,weekMin,streak,byDay,byProject,totalPomos:focus.length,all:sessions};
}
function exportCSV(sessions){
  const rows=[['id','type','project','duration_min','actual_min','startedAt','endedAt','completed']];
  sessions.forEach(s=>rows.push([s.id,s.type,s.project,s.duration_min,s.actual_min,new Date(s.startedAt).toISOString(),s.endedAt?new Date(s.endedAt).toISOString():'',s.completed?1:0]));
  return rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
}
window.PomoDB={initDB,addSession,putSession,getSessions,clearSessions,addTask,putTask,updateTask,deleteTask,getTasks,getProjects,getSetting,setSetting,getAllSettings,getStats,dayKey,exportCSV,uid};
