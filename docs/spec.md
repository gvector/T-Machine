# Personal Turing Machine Simulator — Spec

## Architecture
- Single Vite + React + TypeScript app. No backend: the simulation runs in the browser.
- Libraries: `yaml` (parsing with line numbers), React Flow + auto-layout (state diagram), Vitest (engine tests).
- Run locally with `npm run dev`. Later options: static hosting (GitHub Pages / Netlify), Tauri desktop app (Rust).

## Machine model
- Single tape, infinite in both directions.
- Alphabet is only `0` (white) and `1` (black). Every unwritten tile is `0`.
- Moves: `left`, `right`, `stay`.
- One kind of halt: entering any state listed in `halt_states`.
- No rule for the current (state, symbol) → status **stuck**.
- Step limit: default 10,000, overridable with `max_steps:` in the file or in the UI → status **step limit reached** (pauses, not halted).

## File format (YAML)
```yaml
name: Busy Beaver (3 states)
description: Writes six 1s and halts
tape: ""
start_state: A
start_position: 0
halt_states: [H]
max_steps: 10000          # optional
rules:
  - { state: A, read: 0, write: 1, move: right, next: B }
```
Validation errors (shown in the editor with line number; the last valid machine stays on screen):
- YAML syntax errors
- missing/invalid required keys (`start_state`, `rules`, ...)
- symbols other than `0`/`1` in `tape`, `read`, `write`
- `move` not in `left|right|stay`
- `next` / `start_state` / `halt_states` referring to unknown states
- duplicate rule for the same (state, read)

## Screen
- **State diagram** (top): each state a colorful ball; current state glows; halt states marked; arrows labeled `read→write, move`; last fired arrow lights up; balls draggable; automatic initial layout.
- **Status line**: current state, step counter, status (ready / running / paused / halted / stuck / step limit reached).
- **Tape** (bottom): black/white tiles, ~25 visible, view follows the head and slides smoothly; head marker; position ruler (…, -1, 0, 1, …).
- **Controls**: Step, Run/Pause, speed slider, Step back (full history), Reset, step-limit field.
  - Slow speeds animate every step; high speeds skip animations and redraw a few times per second.
  - Shortcuts: `Space` run/pause, `→` step, `←` step back, `R` reset — disabled while typing.
- **Initial tape override** text box.
- Dark, clean, "lab instrument" look.

## Machine files
- Every `.yaml` in `machines/` appears automatically in a dropdown (Vite glob import).
- Editor panel: live reload while typing, Download button.
- Open file button: load any `.yaml` from disk.

## Bundled content
- Machines: Busy Beaver 3, Busy Beaver 4, unary addition, unary doubler.
- **Learn** panel with 6 short lessons that highlight parts of the screen, advanced with Next:
  1. What you're looking at
  2. Driving the machine
  3. Reading a machine file
  4. Write your first rule
  5. When things go wrong
  6. Build from scratch — challenge with "Show solution"
- Browser remembers lesson progress, editor contents and speed (localStorage, wrapped in try/catch).
