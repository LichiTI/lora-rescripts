Root cleanup note - 2026-03-22

Files quarantined:
- `run.ipynb`
- `train.ipynb`

Why they were moved:
- No live references were found in the current repository.
- They are not part of the active GUI startup path.
- Their contents reflect legacy manual/Jupyter workflows rather than the current packaged launcher flow.

Why they were not deleted outright:
- Cloud or notebook-based users may still want them as reference material.
- Keeping them in `.delete/legacy-notebooks` preserves recoverability.

Follow-up risk noticed during cleanup:
- `install.bash` is still an older Linux install path and is not fully aligned with the current Windows-side packaging and dependency decisions.
- This is a refactor/synchronization task, not a safe cleanup-only move.
