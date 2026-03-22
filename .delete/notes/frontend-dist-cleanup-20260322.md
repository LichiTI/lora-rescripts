Frontend dist cleanup note - 2026-03-22

What was checked:
- `frontend/dist/index.html`
- `frontend/dist/tageditor.html`
- `frontend/dist/tagger.html`
- `frontend/dist/task.html`
- `frontend/dist/tensorboard.html`
- referenced files under `frontend/dist/assets`

Findings:
- The exported HTML pages still contain direct references to multiple hashed JS chunks for the same routes.
- This is not just an on-disk duplicate situation; the final HTML files themselves preload multiple route chunks.
- Example:
  - `frontend/dist/index.html` currently preloads both `assets/index.html.c6ef684b.js` and `assets/index.html.ec4ace46.js`.

Decision:
- Do not move frontend `dist/assets` duplicates into `.delete` yet.
- Clean this area only after we either:
  1. rebuild a fresh frontend dist, or
  2. fully map which hashed assets are safe to drop without breaking route loading.

Why this note exists:
- to preserve the cleanup rationale for later refactor work
- to avoid repeating risky "delete old hash files and hope" experiments
