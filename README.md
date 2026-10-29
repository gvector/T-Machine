# Turing machine

A personal Turing machine simulator. A machine is a small YAML file; the app draws it as
colored state balls with labeled arrows and runs it on a tape of black (1) and white (0) tiles.

```sh
npm install
npm run dev      # open the printed localhost URL
npm test         # engine tests
npm run build    # static site in dist/
```

Open **Learn** in the app for a guided tour. The full design is in [docs/spec.md](docs/spec.md).

## Machine files

Every `.yaml` in [`machines/`](machines) shows up in the app's menu. You can also open a file from
anywhere with **Open file**, edit it in the app, and save it with **Download**.

```yaml
name: Busy Beaver (3 states)
description: Writes six 1s in 14 steps, then halts.
tape: ""              # starting tiles, e.g. "111 0 11"; everything else is 0
start_state: A
start_position: 0     # optional, default 0
halt_states: [H]
max_steps: 10000      # optional safety limit, default 10,000

rules:
  - { state: A, read: 0, write: 1, move: right, next: B }   # move: left | right | stay
```

## Shortcuts

`Space` run/pause · `→` step · `←` step back · `R` reset · `Esc` leave the editor

## Layout

- `src/engine/` — parser/validator and the stepper (no React, fully tested)
- `src/components/` — diagram, tape, controls, editor, guide
- `machines/` — bundled example machines
