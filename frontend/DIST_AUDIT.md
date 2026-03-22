# Frontend Dist Audit

Audit command:

```bash
python scripts/dev/tools/audit_frontend_dist.py
```

Latest local findings on 2026-03-22:
- `frontend/dist` contains 17 HTML files
- `frontend/dist/assets` contains 68 assets
- 29 route chunk groups currently have multiple hashed variants
- all 17 HTML files have modulepreload conflicts
- 16 HTML files have prefetch conflicts
- 0 assets are unreachable from the current HTML-plus-asset graph
- 3 assets are only reachable through prefetch paths

What this means:
- the current dist is internally consistent enough to run
- but it is not a clean single-generation build output
- multiple hashed route chunks are still being referenced side by side
- deleting duplicate chunks from `frontend/dist/assets` right now is risky

Practical conclusion:
1. Do not quarantine or delete `frontend/dist/assets` duplicates yet.
2. Keep using the audit script before any frontend cleanup pass.
3. Rebuild from `frontend/source` first, then replace `frontend/dist` in one shot.

Examples of current modulepreload conflicts:
- `frontend/dist/index.html` preloads both `assets/index.html.c6ef684b.js` and `assets/index.html.ec4ace46.js`
- `frontend/dist/lora/tools.html` preloads both `assets/tools.html.6c8bfc09.js` and `assets/tools.html.c0a4659a.js`
- `frontend/dist/tageditor.html` preloads both `assets/tageditor.html.173f1b6a.js` and `assets/tageditor.html.66da263e.js`
