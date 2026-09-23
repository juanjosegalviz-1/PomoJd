# PomoJd 🍅 — Pomodoro multipágina con base de datos

App estática lista para Cloudflare Pages. Guarda sesiones de estudio/trabajo en IndexedDB (`pomojd-db`).

## Páginas
- `index.html` → Temporizador (foco 25 / corto 5 / largo 15, racha, meta diaria)
- `tareas.html` → Tareas + proyectos
- `stats.html` → Dashboard 7 días, por proyecto, historial, export CSV/JSON
- `config.html` → Duraciones, toggles sonido/notif/auto-start, gestión datos

## Base de datos (IndexedDB)
Stores: `sessions`, `tasks`, `projects`, `settings`. Ver `js/db.js`.
Futura sync D1 vía `functions/api/sessions.js` (GET/POST).

## Desarrollo local
```powershell
npx serve .
# o
python -m http.server 8000
```

## Deploy Cloudflare Pages
```powershell
npx wrangler pages deploy . --project-name=pomojd
```
Output dir = raíz (`.`). Sin build.

## D1 futuro
```sql
CREATE TABLE sessions (id TEXT PRIMARY KEY, type TEXT, project TEXT, taskId TEXT, duration_min INTEGER, actual_min REAL, startedAt INTEGER, endedAt INTEGER, completed INTEGER, notes TEXT);
```
Binding: `DB` → `pomojd-db`.
