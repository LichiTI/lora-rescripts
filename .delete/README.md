# .delete

This directory is a quarantine area for files we do not want to delete outright yet.

Rules:
- Move low-confidence cleanup targets here before permanent deletion.
- Keep original filenames when possible.
- Prefer adding a short note below whenever files are moved in.
- If a moved file turns out to be required, restore it from here instead of recreating it from memory.

Current notes:
- 2026-03-22: root-level `*.bak*` maintenance backup files are being moved here first.
- 2026-03-22: root-level README maintenance backups were moved into `.delete/backups/docs`.
- 2026-03-22: frontend `dist` hashed assets were not quarantined yet because exported HTML still references multiple hash generations directly.
- 2026-03-22: root-level legacy Jupyter notebooks were moved into `.delete/legacy-notebooks`.
- 2026-03-22: Chinese-language backup snapshots for later Linux sync edits were added under `.delete/backups`.
