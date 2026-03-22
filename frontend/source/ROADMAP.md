# Frontend Migration Roadmap

This roadmap is for rebuilding the frontend from source without breaking the current shipped runtime.

## Phase 1: Safe migration targets

Targets:
- `index.html`
- `other/about.html`
- `other/settings.html`
- `tageditor.html`
- `tensorboard.html`
- `task.html`
- `lora/tools.html`

Current source workspace coverage:
- `#/about`
- `#/settings`
- `#/tasks`
- `#/tageditor`
- `#/tensorboard`
- `#/tools`

Why first:
- lighter backend coupling
- lower risk than schema-heavy training forms
- good places to establish shared layout, navigation and fetch patterns

Core backend files touched by this phase:
- `mikazuki/app/application.py`
- `mikazuki/app/proxy.py`
- `mikazuki/app/api.py`

## Phase 2: Shared schema bridge

Goal:
- consume `/api/schemas/all` in a stable source-side renderer
- stop hiding form logic inside legacy hashed chunks

Current progress:
- `#/schema-bridge` now evaluates the current schema DSL in the source workspace
- the first bridge supports common field kinds: string, number, boolean, enum-like union and simple string arrays
- default focus is `sdxl-lora`
- `#/sdxl-train` now uses that bridge to build a first real SDXL source-side training page and submit to `/api/run`
- the shared training bridge now also powers `#/flux-train`, `#/sd3-train`, `#/dreambooth-train`, `#/sd-controlnet-train`, `#/sdxl-controlnet-train`, `#/flux-controlnet-train`, and `#/sdxl-lllite-train`

Core backend files touched by this phase:
- `mikazuki/app/api.py`
- `mikazuki/schema/shared.ts`
- `mikazuki/schema/*.ts`

## Phase 3: Primary training pages

Recommended order:
1. `lora/sdxl.html`
2. `lora/flux.html`
3. `lora/sd3.html`
4. `dreambooth/index.html`
5. `lora/controlnet.html`
6. `lora/sdxl-controlnet.html`
7. `lora/flux-controlnet.html`
8. `lora/sdxl-lllite.html`

Why this order:
- SDXL is the most important real-world path
- Flux and SD3 are closer to the current fast-moving kohya core
- Dreambooth is still useful, but less central than the LoRA routes

Core backend files touched by this phase:
- `mikazuki/app/api.py`
- `mikazuki/schema/sdxl-lora.ts`
- `mikazuki/schema/flux-lora.ts`
- `mikazuki/schema/sd3-lora.ts`
- `mikazuki/schema/dreambooth.ts`

## Phase 4: Legacy cleanup

Only after a clean source-built frontend is ready:
- replace `frontend/dist` in one shot
- remove duplicated hashed route chunks
- shrink the legacy runtime snapshot

Supporting files for that cleanup:
- `frontend/SOURCE_STATUS.md`
- `frontend/DIST_AUDIT.md`
- `scripts/dev/tools/audit_frontend_dist.py`
