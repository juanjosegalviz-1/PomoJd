// Cloudflare Pages Function - espejo futuro para D1
// Si hay binding DB (D1), guarda/lee. Si no, responde ok sin persistencia (el cliente usa IndexedDB).
export async function onRequestGet(context){
  try{
    const DB=context.env?.DB;
    if(!DB) return Response.json({ok:true,mode:'local',sessions:[],note:'Sin D1: usando IndexedDB local'});
    const url=new URL(context.request.url);
    const limit=Math.min(200,parseInt(url.searchParams.get('limit')||'50'));
    const r=await DB.prepare('SELECT * FROM sessions ORDER BY startedAt DESC LIMIT ?').bind(limit).all();
    return Response.json({ok:true,mode:'d1',sessions:r.results||[]});
  }catch(e){return Response.json({ok:false,error:String(e)}, {status:500});}
}
export async function onRequestPost(context){
  try{
    const body=await context.request.json();
    const DB=context.env?.DB;
    if(!DB) return Response.json({ok:true,mode:'local',id:body.id||'local',note:'Guardado local, sin D1'});
    const id=body.id||crypto.randomUUID();
    await DB.prepare(`INSERT OR IGNORE INTO sessions (id,type,project,taskId,duration_min,actual_min,startedAt,endedAt,completed,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(id,body.type||'focus',body.project||'general',body.taskId||null,body.duration_min||25,body.actual_min||25,body.startedAt||Date.now(),body.endedAt||Date.now(),body.completed?1:0,body.notes||'').run();
    return Response.json({ok:true,mode:'d1',id},{status:201});
  }catch(e){return Response.json({ok:false,error:String(e)},{status:500});}
}
