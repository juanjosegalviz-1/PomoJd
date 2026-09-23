/* PomoJd edge core — cuentas + sincronización por usuario (D1) + estáticos.
   FILES lo inyecta el despliegue: const FILES = {...}
   Binding D1 esperado: env.DB */

const SESSION_DAYS = 30;
const enc = new TextEncoder();

function json(data, status = 200, cookies = []) {
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (cookies.length) h['Set-Cookie'] = cookies;
  // fetch Response admite array en Set-Cookie en Workers
  const res = new Response(JSON.stringify(data), { status, headers: { 'Content-Type': h['Content-Type'], 'Cache-Control': h['Cache-Control'] } });
  for (const c of cookies) res.headers.append('Set-Cookie', c);
  return res;
}
function getCookie(req, name) {
  const h = req.headers.get('Cookie') || '';
  for (const part of h.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
function sessCookie(token, maxAge) {
  return `pomo_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`;
}
function clearCookie() {
  return `pomo_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
}
function rid() { return crypto.randomUUID(); }
function nowMs() { return Date.now(); }

async function hashPassword(password, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g).map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function makeSalt() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
}
function validEmail(e) { return typeof e === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim()); }

async function authUser(req, env) {
  const token = getCookie(req, 'pomo_session');
  if (!token) return null;
  const row = await env.DB.prepare('SELECT user_id, expires_at FROM user_sessions WHERE token = ?').bind(token).first();
  if (!row || row.expires_at < nowMs()) return null;
  const u = await env.DB.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').bind(row.user_id).first();
  return u || null;
}
async function newSession(env, userId) {
  const token = rid() + '.' + rid().replace(/-/g, '');
  const t = nowMs();
  await env.DB.prepare('INSERT INTO user_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(token, userId, t, t + SESSION_DAYS * 86400000).run();
  return token;
}

async function handleAuth(req, env, url) {
  const path = url.pathname;
  if (path === '/api/auth/register' && req.method === 'POST') {
    let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'JSON inválido' }, 400); }
    const name = String(b.name || '').trim().slice(0, 40);
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (!name) return json({ ok: false, error: 'Escribe tu nombre' }, 400);
    if (!validEmail(email)) return json({ ok: false, error: 'Email no válido' }, 400);
    if (password.length < 6) return json({ ok: false, error: 'La clave necesita 6+ caracteres' }, 400);
    const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (exists) return json({ ok: false, error: 'Ese email ya tiene cuenta. Entra.' }, 409);
    const salt = makeSalt();
    const hash = await hashPassword(password, salt);
    const id = rid(), t = nowMs();
    await env.DB.prepare('INSERT INTO users (id, name, email, pass_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, name, email, hash, salt, t).run();
    // ajustes iniciales
    const defaults = [['focus_min', '25'], ['short_min', '5'], ['long_min', '15'], ['daily_goal', '8']];
    const stmt = env.DB.prepare('INSERT OR IGNORE INTO settings (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)');
    await env.DB.batch(defaults.map(([k, v]) => stmt.bind(id, k, v, t)));
    const token = await newSession(env, id);
    return json({ ok: true, user: { id, name, email } }, 201, [sessCookie(token, SESSION_DAYS * 86400)]);
  }
  if (path === '/api/auth/login' && req.method === 'POST') {
    let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'JSON inválido' }, 400); }
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    const u = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!u) return json({ ok: false, error: 'No hay cuenta con ese email' }, 401);
    const hash = await hashPassword(password, u.salt);
    // comparación constante
    let same = hash.length === u.pass_hash.length;
    for (let i = 0; i < hash.length && i < u.pass_hash.length; i++) same = same && hash[i] === u.pass_hash[i];
    if (!same) return json({ ok: false, error: 'Clave incorrecta' }, 401);
    const token = await newSession(env, u.id);
    return json({ ok: true, user: { id: u.id, name: u.name, email: u.email } }, 200, [sessCookie(token, SESSION_DAYS * 86400)]);
  }
  if (path === '/api/auth/logout' && req.method === 'POST') {
    const token = getCookie(req, 'pomo_session');
    if (token) await env.DB.prepare('DELETE FROM user_sessions WHERE token = ?').bind(token).run();
    return json({ ok: true }, 200, [clearCookie()]);
  }
  if (path === '/api/auth/me' && req.method === 'GET') {
    const u = await authUser(req, env);
    if (!u) return json({ ok: false, error: 'Sin sesión' }, 401);
    return json({ ok: true, user: u });
  }
  return null;
}

async function handleSync(req, env, url, user) {
  const path = url.pathname;
  const t = nowMs();
  if (path === '/api/sync/pull' && req.method === 'GET') {
    const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;
    const sessions = await env.DB.prepare('SELECT * FROM sessions WHERE user_id = ? AND updated_at > ? ORDER BY startedAt DESC LIMIT 2000').bind(user.id, since).all();
    const tasks = await env.DB.prepare('SELECT * FROM tasks WHERE user_id = ? AND updated_at > ? ORDER BY created_at DESC LIMIT 1000').bind(user.id, since).all();
    const settings = await env.DB.prepare('SELECT key, value, updated_at FROM settings WHERE user_id = ? AND updated_at > ?').bind(user.id, since).all();
    const running = await env.DB.prepare('SELECT * FROM running WHERE user_id = ?').bind(user.id).first();
    return json({ ok: true, sessions: sessions.results || [], tasks: tasks.results || [], settings: settings.results || [], running: running || null, server_time: t });
  }
  if (path === '/api/sync/push' && req.method === 'POST') {
    let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'JSON inválido' }, 400); }
    const ops = [];
    for (const s of (b.sessions || []).slice(0, 2000)) {
      if (!s.id || !s.startedAt) continue;
      ops.push(env.DB.prepare(`INSERT INTO sessions (id, user_id, type, project, taskId, duration_min, actual_min, startedAt, endedAt, completed, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET type=excluded.type, project=excluded.project, taskId=excluded.taskId, duration_min=excluded.duration_min, actual_min=excluded.actual_min, startedAt=excluded.startedAt, endedAt=excluded.endedAt, completed=excluded.completed, notes=excluded.notes, updated_at=excluded.updated_at
        WHERE excluded.updated_at >= sessions.updated_at AND sessions.user_id = ?`)
        .bind(s.id, user.id, s.type || 'focus', s.project || 'general', s.taskId || null, s.duration_min || 0, s.actual_min || 0, s.startedAt, s.endedAt || null, s.completed ? 1 : 0, s.notes || '', s.updated_at || t, user.id));
    }
    for (const k of (b.tasks || []).slice(0, 1000)) {
      if (!k.id || !k.title) continue;
      ops.push(env.DB.prepare(`INSERT INTO tasks (id, user_id, title, project, estimated_pomos, completed_pomos, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, project=excluded.project, estimated_pomos=excluded.estimated_pomos, completed_pomos=excluded.completed_pomos, done=excluded.done, updated_at=excluded.updated_at
        WHERE excluded.updated_at >= tasks.updated_at AND tasks.user_id = ?`)
        .bind(k.id, user.id, String(k.title).slice(0, 200), k.project || 'general', k.estimated_pomos || 4, k.completed_pomos || 0, k.done ? 1 : 0, k.created_at || t, k.updated_at || t, user.id));
    }
    for (const [k, v] of Object.entries(b.settings || {}).slice(0, 60)) {
      ops.push(env.DB.prepare(`INSERT INTO settings (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at WHERE excluded.updated_at >= settings.updated_at`)
        .bind(user.id, String(k).slice(0, 60), String(v).slice(0, 500), b.settings_updated_at || t));
    }
    for (const id of (b.deleted_tasks || []).slice(0, 500)) {
      ops.push(env.DB.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').bind(String(id), user.id));
    }
    for (let i = 0; i < ops.length; i += 50) await env.DB.batch(ops.slice(i, i + 50));
    return json({ ok: true, pushed: ops.length, server_time: t });
  }
  return null;
}

async function handleTimer(req, env, url, user) {
  const path = url.pathname;
  const t = nowMs();
  if (path === '/api/timer' && req.method === 'GET') {
    const r = await env.DB.prepare('SELECT * FROM running WHERE user_id = ?').bind(user.id).first();
    return json({ ok: true, running: r || null, server_time: t });
  }
  if (path === '/api/timer' && (req.method === 'PUT' || req.method === 'POST')) {
    let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'JSON inválido' }, 400); }
    if (!b.ends_at || !b.mode) return json({ ok: false, error: 'Faltan datos' }, 400);
    await env.DB.prepare('INSERT INTO running (user_id, mode, project, taskId, started_at, ends_at, duration_sec, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET mode=excluded.mode, project=excluded.project, taskId=excluded.taskId, started_at=excluded.started_at, ends_at=excluded.ends_at, duration_sec=excluded.duration_sec, updated_at=excluded.updated_at')
      .bind(user.id, b.mode, b.project || 'general', b.taskId || null, b.started_at || t, b.ends_at, b.duration_sec || 0, t).run();
    return json({ ok: true, server_time: t });
  }
  if (path === '/api/timer' && req.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM running WHERE user_id = ?').bind(user.id).run();
    return json({ ok: true });
  }
  return null;
}

const NOTFOUND = "<!doctype html><meta charset=utf-8><body style='background:#08080A;color:#E9E1D3;font-family:sans-serif;padding:40px'><h1>404 — Sin prisa, pero aquí no hay nada.</h1><a style='color:#E14D2E' href='/'>Volver al foco</a>";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    try {
      if (path.startsWith('/api/auth/')) {
        const r = await handleAuth(req, env, url);
        return r || json({ ok: false, error: 'No encontrado' }, 404);
      }
      if (path.startsWith('/api/sync/') || path === '/api/timer') {
        const user = await authUser(req, env);
        if (!user) return json({ ok: false, error: 'Entra en tu cuenta primero', need_auth: true }, 401);
        if (path.startsWith('/api/sync/')) return (await handleSync(req, env, url, user)) || json({ ok: false }, 404);
        return (await handleTimer(req, env, url, user)) || json({ ok: false }, 404);
      }
      if (path.startsWith('/api/')) return json({ ok: false, error: 'No encontrado' }, 404);
      let p = path;
      if (p === '/') p = '/index.html';
      const f = FILES[p];
      if (!f) return new Response(NOTFOUND, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      return new Response(f.body, { headers: { 'Content-Type': f.ct, 'Cache-Control': 'public, max-age=3600' } });
    } catch (e) {
      return json({ ok: false, error: 'Error interno' }, 500);
    }
  }
};
