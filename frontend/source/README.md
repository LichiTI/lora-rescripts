# Frontend Source Workspace

This directory is a new maintainable frontend workspace for future migration work.

Important:
- it does not replace the current runtime under `frontend/dist`
- it is intentionally isolated so we can rebuild pages gradually
- its build output goes to `frontend/source/dist-dev`, not to `frontend/dist`

Current purpose:
- keep route inventory in source form
- keep backend API inventory in source form
- provide a small migration workbench instead of editing hashed dist files directly
- load live backend diagnostics for schemas, presets, tasks, GPUs and tag editor status
- host source-side migration pages for `about`, `settings`, `tasks`, `tageditor`, `tensorboard` and `tools`
- host a first source-side SDXL training page backed by the schema bridge

Suggested commands:

```bash
cd frontend/source
npm install
npm run dev
```

Useful page hashes after startup:
- `#/workspace`
- `#/about`
- `#/settings`
- `#/tasks`
- `#/tageditor`
- `#/tensorboard`
- `#/tools`
- `#/schema-bridge`
- `#/sdxl-train`

Default dev behavior:
- the Vite dev server runs on `127.0.0.1:4173`
- `/api/*` is proxied to `http://127.0.0.1:28000`
- this lets the source workspace talk to the current FastAPI backend without changing the shipped runtime

Optional environment override:
- set `VITE_API_BASE_URL` if you want the workbench to call a different backend directly
- set `VITE_RUNTIME_BASE_URL` if you want legacy-page links to point to a different shipped UI origin
- see `.env.example`

Production status:
- not wired into FastAPI yet
- not feature-complete
- safe to iterate on without risking the current shipped UI
- legacy dist-era paths like `/task.html`, `/tageditor.html`, `/other/about.html` and `/lora/sdxl.html` now auto-normalize to the nearest maintained `#/...` route when the source app is used as runtime
