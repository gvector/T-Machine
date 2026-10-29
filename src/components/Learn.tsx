import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { parseMachine } from '../engine/parse'
import { Run } from '../engine/run'
import type { Bit } from '../engine/types'

export const CHALLENGE_START = `# Challenge: make a block of 1s one tile longer.
#   111 -> 1111
# The head starts on the first 1. One rule is already here.
name: Add one
description: Turns a block of 1s into a block one tile longer.
tape: "111"
start_state: walk
start_position: 0
halt_states: [done]

rules:
  - { state: walk, read: 1, write: 1, move: right, next: walk }
`

const CHALLENGE_SOLUTION = `  - { state: walk, read: 0, write: 1, move: stay, next: done }`

interface Page {
  lesson: number
  title: string
  /** data-tour id of the screen area to highlight */
  target?: string
  body: ReactNode
  load?: { label: string; machine: string }
  challenge?: boolean
}

const PAGES: Page[] = [
  {
    lesson: 1, title: 'What you’re looking at',
    body: <>
      <p>A Turing machine is a very small computer. It reads one tile of a long tape, looks up a rule for what it
        just read, writes a tile, moves one step, and switches to another state. That’s everything it can do,
        and it’s enough to compute anything a laptop can.</p>
      <p>Load the 3-state Busy Beaver to follow along.</p>
    </>,
    load: { label: 'Load Busy Beaver (3 states)', machine: 'busy-beaver-3.yaml' },
  },
  {
    lesson: 1, title: 'States are balls', target: 'diagram',
    body: <>
      <p>Each colored ball is a <b>state</b>: a mood the machine is in. The glowing ball is the state it’s in right
        now. The small dot marks the start state, and a ball with a double ring is a <b>halt state</b>: reaching it
        stops the machine.</p>
      <p>You can drag the balls around to tidy the picture.</p>
    </>,
  },
  {
    lesson: 1, title: 'Arrows are rules', target: 'diagram',
    body: <>
      <p>Each arrow is a <b>rule</b>. A label like <code>0 → 1, R</code> means: “if you read 0, write 1, move
        Right, then follow the arrow to the next state”. <code>L</code> is left and <code>S</code> is stay.</p>
      <p>When a rule runs, its arrow and label light up.</p>
    </>,
  },
  {
    lesson: 1, title: 'The tape', target: 'tape',
    body: <>
      <p>The tape is a row of tiles. White is <b>0</b>, black is <b>1</b>. It goes on forever in both directions,
        and every tile you can’t see is white.</p>
      <p>The ball above the tape is the <b>head</b>, painted in the current state’s color. The tape slides under it,
        and the numbers under the tiles tell you the position.</p>
    </>,
  },
  {
    lesson: 1, title: 'The status line', target: 'status',
    body: <p>Here you see the current state, how many steps have run, how many 1s are on the tape, and whether the
      machine is ready, running, halted or stuck.</p>,
  },
  {
    lesson: 2, title: 'Take one step', target: 'controls',
    body: <>
      <p>Press the <b>step</b> button (or the <kbd>→</kbd> key) a few times. Watch the arrow that lights up, the tile
        that changes and the ball that starts glowing.</p>
    </>,
  },
  {
    lesson: 2, title: 'Run, pause, change speed', target: 'controls',
    body: <>
      <p>The big button (or <kbd>Space</kbd>) runs and pauses. The slider sets how many steps happen per second. At
        slow speeds every step is animated; at fast speeds the screen only refreshes a few times a second.</p>
    </>,
  },
  {
    lesson: 2, title: 'Rewind', target: 'controls',
    body: <>
      <p><b>Step back</b> (<kbd>←</kbd>) undoes one step at a time, all the way to the start. <b>Reset</b>
        (<kbd>R</kbd>) jumps straight back to step 0. Shortcuts are off while you’re typing in the editor: press
        <kbd>Esc</kbd> to leave it.</p>
    </>,
  },
  {
    lesson: 3, title: 'The machine file', target: 'editor',
    body: <>
      <p>Everything on screen comes from this file. The top part sets up the machine:</p>
      <ul>
        <li><code>tape</code>: the starting tiles, for example <code>"111 0 11"</code> (spaces are ignored)</li>
        <li><code>start_state</code> and <code>start_position</code>: where the machine begins</li>
        <li><code>halt_states</code>: the states that stop it</li>
        <li><code>max_steps</code> (optional): a safety limit, 10,000 if you leave it out</li>
      </ul>
    </>,
  },
  {
    lesson: 3, title: 'One rule per line', target: 'editor',
    body: <>
      <p>Each line under <code>rules</code> is one arrow in the diagram:</p>
      <pre>{'- { state: A, read: 0, write: 1,\n    move: right, next: B }'}</pre>
      <p>“In state A, reading 0: write 1, move right, go to state B.” A state needs at most two rules: one for
        reading 0 and one for reading 1.</p>
    </>,
  },
  {
    lesson: 4, title: 'Change a rule', target: 'editor',
    body: <>
      <p>In the first rule, change <code>move: right</code> to <code>move: left</code>. The diagram updates while you
        type and the run starts again from step 0.</p>
      <p>Run it. Does it still halt? How many 1s does it write now? Change it back when you’re done (or reload the
        machine from the menu).</p>
    </>,
  },
  {
    lesson: 5, title: 'Mistakes in the file', target: 'editor',
    body: <>
      <p>Try typing <code>read: 2</code> in any rule. A red list appears under the editor with the line number,
        and the line turns red in the margin. Click the line number to jump there.</p>
      <p>While the file has a mistake, the screen keeps showing the last version that worked.</p>
    </>,
  },
  {
    lesson: 5, title: 'Stuck and step limits', target: 'settings',
    body: <>
      <p><b>Stuck</b> means the machine reached a state with no rule for the tile it’s reading. It isn’t an error in
        the file, just a gap in the rules.</p>
      <p><b>Step limit reached</b> stops machines that would run forever. Raise the limit here to keep going. You can
        also try a different starting tape here without editing the file.</p>
    </>,
  },
  {
    lesson: 6, title: 'Your turn', target: 'editor', challenge: true,
    body: <>
      <p>Build a machine that makes a block of 1s one tile longer: <code>111</code> becomes <code>1111</code>.</p>
      <p>Load the starting file. It already walks right over the 1s. What should happen when it reads a 0?</p>
    </>,
  },
]

interface Props {
  page: number
  onPage: (page: number) => void
  onClose: () => void
  onLoadMachine: (id: string) => void
  onLoadText: (text: string) => void
  editorText: string
}

export function Learn({ page: wanted, onPage, onClose, onLoadMachine, onLoadText, editorText }: Props) {
  // a page saved by an older version may no longer exist
  const page = Math.min(Math.max(0, wanted), PAGES.length - 1)
  const p = PAGES[page]
  const lessons = Math.max(...PAGES.map(x => x.lesson))
  const [check, setCheck] = useState<string | null>(null)
  const [showSolution, setShowSolution] = useState(false)

  useEffect(() => { setCheck(null); setShowSolution(false) }, [page])

  return (
    <aside className="learn" aria-label="Guide">
      <Spotlight target={p.target} />
      <header className="learn-head">
        <span className="learn-progress">Lesson {p.lesson} of {lessons}</span>
        <button type="button" className="link" onClick={onClose}>Close guide</button>
      </header>
      <h2>{p.title}</h2>
      <div className="learn-body">{p.body}</div>

      {p.load && <button type="button" className="btn" onClick={() => onLoadMachine(p.load!.machine)}>{p.load.label}</button>}

      {p.challenge && (
        <div className="challenge">
          <div className="challenge-actions">
            <button type="button" className="btn" onClick={() => onLoadText(CHALLENGE_START)}>Load the starting file</button>
            <button type="button" className="btn" onClick={() => setCheck(checkChallenge(editorText))}>Check my machine</button>
          </div>
          {check && <p className="challenge-result" role="status">{check}</p>}
          {showSolution
            ? <>
              <p>Add this rule: on a 0, write the extra 1 and stop.</p>
              <pre>{CHALLENGE_SOLUTION.trim()}</pre>
              <p>Next challenge: make the block <i>two</i> tiles longer.</p>
            </>
            : <button type="button" className="link" onClick={() => setShowSolution(true)}>Show solution</button>}
        </div>
      )}

      <footer className="learn-nav">
        <button type="button" className="btn" onClick={() => onPage(page - 1)} disabled={page === 0}>Back</button>
        <span className="learn-dots" aria-hidden="true">
          {PAGES.map((x, i) => x.lesson === p.lesson && <span key={i} className={i === page ? 'is-on' : undefined} />)}
        </span>
        {page < PAGES.length - 1
          ? <button type="button" className="btn btn-primary" onClick={() => onPage(page + 1)}>Next</button>
          : <button type="button" className="btn btn-primary" onClick={onClose}>Finish</button>}
      </footer>
    </aside>
  )
}

/** Runs the editor's machine on a few inputs and explains the first one that goes wrong. */
function checkChallenge(text: string): string {
  const parsed = parseMachine(text)
  if (!parsed.ok) return 'The file has mistakes. Fix the red lines under the editor first.'
  for (const n of [1, 2, 3, 5]) {
    const input = Array<Bit>(n).fill(1)
    const run = new Run(parsed.machine, input)
    run.limit = 1000
    while (run.step()) { /* run to the end */ }
    const tape = '1'.repeat(n)
    if (run.status === 'stuck') return `On ${tape} the machine got stuck in state ${run.state} reading ${run.read(run.head)}. Which rule is missing?`
    if (run.status === 'limit') return `On ${tape} the machine never stopped. Does some rule lead to a halt state?`
    if (run.tapeString() !== '1'.repeat(n + 1)) return `On ${tape} the tape ended as ${run.tapeString() || 'all 0s'}, but it should be ${'1'.repeat(n + 1)}.`
  }
  return 'It works on 1, 11, 111 and 11111. Well done.'
}

/** Dims the screen except the area the current page talks about. */
function Spotlight({ target }: { target?: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!target) { setRect(null); return }
    const measure = () => {
      const el = document.querySelector(`[data-tour="${target}"]`)
      const next = el ? el.getBoundingClientRect() : null
      // keep the old object when nothing moved, so polling doesn't re-render
      setRect(prev => prev && next && prev.top === next.top && prev.left === next.left
        && prev.width === next.width && prev.height === next.height ? prev : next)
    }
    measure()
    const id = window.setInterval(measure, 400) // panels resize and scroll; cheap enough to poll
    window.addEventListener('resize', measure)
    return () => { window.clearInterval(id); window.removeEventListener('resize', measure) }
  }, [target])
  if (!rect) return null
  return createPortal(
    <div className="spotlight" aria-hidden="true"
      style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />,
    document.body,
  )
}
