# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Bitácora de Aprendizaje": a personal study log + habit tracker. Plain HTML/CSS/JS, no frameworks, no build step, no package manager, no tests. Exactly three files: `index.html`, `styles.css`, `app.js`. Do not add dependencies or extra files. All UI text is in Spanish.

To run: open `index.html` directly in a browser (must also work from `file://` and GitHub Pages). There is no lint or test command.

## Constraints that are easy to break

- **Extension contract:** a Claude-in-Chrome shortcut pastes JSON into the page. The ids `importar-json`, `importar-btn`, `importar-ok` (and `importar-error`) must not change, and the "Importar captura" section must stay visible (that is why navigation is anchors, not hidden tabs).
- **Local dates only:** never use `toISOString()` or UTC for dates. Use `fechaLocal`, `leerFecha`, `sumarDias`, `diferenciaDias` in `app.js`. Dates are `"YYYY-MM-DD"` strings and compared as strings.
- **Single storage key** `"bitacora-v1"` with a `version` field. Schema changes go through `normalizar()` (the migration point) and `VERSION`.
- **Points are derived, never stored.** `calcularPuntos()` recomputes from `datos.sesiones` (+10/session, +1 per 5 min, +20 per active day, +50 per multiple of 7 within each streak run). Deleting a session must just work; don't add incremental counters.
- Build DOM with the `h()` helper (text nodes, no `innerHTML`) since content comes from pasted JSON.

- **Password lock:** everything lives inside `#app` (hidden until unlocked); `render()` only runs from `mostrarApp()`, so don't call it at startup. The PBKDF2 hash and unlock expiry (`datos.acceso`) live inside the single `bitacora-v1` key and are excluded from exports and preserved on backup restore. It is a client-side screen lock, not real security.

## Architecture (`app.js`)

Single global `datos` object (`sesiones`, `habitos`, `marcas` keyed by habit id then date, `notas` keyed by date) loaded by `cargar()` and persisted by `guardar()`. Every mutation does: change `datos` → `guardar()` → `render()` (which redraws panel, historial, habitos wholesale). Exception: day notes save without re-rendering to keep input focus.

Both the JSON import and the manual form go through `validarSesion()` → `guardarSesion()`, which upserts on same `url` + `fecha` (update instead of duplicate). Keep new entry points on this path.

Habits: `"diario"` habits use `marcas`; `"diassin"` habits store `inicio` and `record` and are reset via `reiniciarDiasSin`. A daily habit named "Estudio" (`esEstudio`) is auto-marked from sessions and its checkboxes are disabled. Habit streaks (`rachasHabito`) skip non-target weekdays; weekday index is Monday = 0.
