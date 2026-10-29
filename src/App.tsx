import { useEffect, useMemo, useRef, useState } from 'react'
import { Controls, StatusLine } from './components/Controls'
import { Diagram } from './components/Diagram'
import { Editor } from './components/Editor'
import { Learn } from './components/Learn'
import { Tape } from './components/Tape'
import { stateColors } from './colors'
import { parseMachine, parseTape } from './engine/parse'
import type { Machine } from './engine/types'
import { bundled, findBundled } from './machines'
import { storage } from './storage'
import { useSimulator } from './useSimulator'

const DEFAULT_ID = 'busy-beaver-3.yaml'
const CUSTOM = 'custom'

/** Identity of a machine ignoring line numbers, so adding a comment doesn't restart the run. */
const signature = (m: Machine) =>
  JSON.stringify({ ...m, rules: m.rules.map(r => [r.state, r.read, r.write, r.move, r.next]) })

function firstMachine(text: string): Machine {
  const parsed = parseMachine(text)
  if (parsed.ok) return parsed.machine
  const fallback = parseMachine(findBundled(DEFAULT_ID)?.text ?? bundled[0].text)
  if (!fallback.ok) throw new Error('Bundled machine is invalid')
  return fallback.machine
}

/** A whole number from storage, falling back when it's missing, garbled or out of range. */
function storedInt(key: string, fallback: number, min: number, max: number): number {
  const n = Number(storage.get(key) ?? fallback)
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export default function App() {
  const [source, setSource] = useState(() => storage.get('source') ?? DEFAULT_ID)
  const [text, setText] = useState(() => storage.get('text') ?? findBundled(DEFAULT_ID)?.text ?? bundled[0].text)
  const [machine, setMachine] = useState(() => firstMachine(text))
  const [tapeText, setTapeText] = useState('')
  const [limitText, setLimitText] = useState(String(machine.maxSteps))
  const [speed, setSpeed] = useState(() => storedInt('speed', 25, 0, 100))
  const [learnOpen, setLearnOpen] = useState(() => storage.get('learnOpen') !== 'false')
  const [page, setPage] = useState(() => storedInt('page', 0, 0, Number.MAX_SAFE_INTEGER))
  const fileInput = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => parseMachine(text), [text])
  useEffect(() => {
    if (parsed.ok && signature(parsed.machine) !== signature(machine)) setMachine(parsed.machine)
  }, [parsed, machine])
  useEffect(() => { setLimitText(String(machine.maxSteps)) }, [machine.maxSteps])

  useEffect(() => { storage.set('text', text) }, [text])
  useEffect(() => { storage.set('source', source) }, [source])
  useEffect(() => { storage.set('speed', String(speed)) }, [speed])
  useEffect(() => { storage.set('learnOpen', String(learnOpen)) }, [learnOpen])
  useEffect(() => { storage.set('page', String(page)) }, [page])

  const tapeOverride = tapeText.trim() ? parseTape(tapeText) : null
  const input = tapeOverride ?? machine.tape
  const limit = Math.max(1, Number.parseInt(limitText, 10) || machine.maxSteps)

  const sim = useSimulator(machine, input, limit, speed)
  const { run } = sim
  const colors = useMemo(() => stateColors(machine), [machine])
  const color = colors.get(run.state) ?? '#fff'

  /** Loading always starts fresh: step 0, the file's own tape and step limit (even when the text is unchanged). */
  const loadText = (next: string, id: string) => {
    const loaded = parseMachine(next)
    setText(next)
    setSource(id)
    setTapeText('')
    if (loaded.ok) setLimitText(String(loaded.machine.maxSteps))
    sim.reset()
  }
  const loadBundled = (id: string) => {
    const m = findBundled(id)
    if (m) loadText(m.text, id)
  }

  const openFile = async (file: File) => loadText(await file.text(), `file:${file.name}`)

  const download = () => {
    const name = source.startsWith('file:') ? source.slice(5)
      : findBundled(source) ? source
      : `${machine.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'machine'}.yaml`
    const url = URL.createObjectURL(new Blob([text], { type: 'text/yaml' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    // revoking right away can cancel the download in some browsers
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const original = findBundled(source)?.text
  const edited = original !== undefined && original !== text

  // Keyboard shortcuts, off while typing in any field.
  const simRef = useRef(sim)
  simRef.current = sim
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return
      const s = simRef.current
      // Space on a focused button presses that button, as usual
      if (e.key === ' ' && t.closest('button, a[href], [role="button"]')) return
      if (e.key === ' ') { e.preventDefault(); s.togglePlay() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); s.step() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); s.stepBack() }
      else if (e.key === 'r' || e.key === 'R') s.reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={`app${learnOpen ? ' with-learn' : ''}`}>
      <header className="topbar">
        <h1>Turing machine</h1>
        <div className="picker">
          <select value={findBundled(source) ? source : CUSTOM} aria-label="Machine"
            onChange={e => loadBundled(e.target.value)}>
            {bundled.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            {!findBundled(source) && (
              <option value={CUSTOM} disabled>{source.startsWith('file:') ? source.slice(5) : 'Your machine'}</option>
            )}
          </select>
          {edited && <>
            <span className="edited">edited</span>
            <button type="button" className="link" onClick={() => loadBundled(source)}>Undo my changes</button>
          </>}
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>Open file</button>
          <input ref={fileInput} type="file" accept=".yaml,.yml,text/yaml" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = '' }} />
          <button type="button" className="btn" onClick={download}>Download</button>
          {!learnOpen && <button type="button" className="btn btn-primary" onClick={() => setLearnOpen(true)}>Learn</button>}
        </div>
      </header>

      <main className="bench">
        <section className="machine-head">
          <h2>{machine.name}</h2>
          {machine.description && <p>{machine.description}</p>}
        </section>
        <Diagram machine={machine} colors={colors} state={run.state} fired={run.lastRule} animated={sim.animated} />
        <StatusLine run={run} playing={sim.playing} color={color} />
        <Tape run={run} color={color} animated={sim.animated} />
        <Controls run={run} playing={sim.playing} speed={speed} onSpeed={setSpeed}
          onStep={sim.step} onBack={sim.stepBack} onToggle={sim.togglePlay} onReset={sim.reset} />
        <div className="settings" data-tour="settings">
          <label>
            <span>Starting tape</span>
            <input type="text" value={tapeText} placeholder={machine.tape.join('') || 'all 0s'} spellCheck={false}
              onChange={e => setTapeText(e.target.value)} aria-invalid={tapeText.trim() !== '' && !tapeOverride} />
            {tapeText.trim() !== '' && !tapeOverride && <em>Use only 0, 1 and spaces</em>}
          </label>
          <label>
            <span>Step limit</span>
            <input type="number" min={1} value={limitText} onChange={e => setLimitText(e.target.value)} />
          </label>
        </div>
      </main>

      <section className="side">
        <Editor text={text} errors={parsed.ok ? [] : parsed.errors} onChange={setText} />
      </section>

      {learnOpen && (
        <Learn page={page} onPage={setPage} onClose={() => setLearnOpen(false)}
          onLoadMachine={loadBundled} onLoadText={t => loadText(t, CUSTOM)} editorText={text} />
      )}
    </div>
  )
}
