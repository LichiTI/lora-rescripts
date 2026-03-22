# Frontend Source Status

Current state:
- `frontend/` in this repository only contains built output under `frontend/dist`.
- The main app serves that built output directly from `frontend/dist`.
- There is no checked-in frontend source tree, package manager lockfile, or active build configuration in the current repository snapshot.

What was verified locally:
- historical commits show that `frontend` used to be a git submodule
- local submodule metadata still exists under `.git/modules/frontend`
- that submodule points to `https://github.com/hanamizuki-ai/lora-gui-dist`
- the local submodule history also contains only built `dist` files, not source files

Implication:
- the original frontend source cannot be recovered from the current repository state or the preserved local submodule history
- continuing to edit hashed files inside `frontend/dist/assets` is possible, but it is not a maintainable long-term workflow

Recommended direction:
1. Treat the current `frontend/dist` as a legacy runtime snapshot.
2. Use `scripts/dev/tools/audit_frontend_dist.py` to inspect HTML-to-asset references before any cleanup.
3. Build new work inside `frontend/source` instead of editing hashed files directly.
4. Recreate a clean production `dist` from source later, then replace the legacy snapshot in one shot.
5. Only after that, remove stale duplicated hashed assets from `frontend/dist/assets`.

Useful command:

```bash
python scripts/dev/tools/audit_frontend_dist.py
```

New source workspace:

```bash
cd frontend/source
npm install
npm run dev
```
