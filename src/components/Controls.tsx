import type { CSSProperties } from 'react'
import type { Run } from '../engine/run'
import { stepsPerSecond } from '../useSimulator'

const icons = {
  reset: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />,
  back: <path d="M15 6l-6 6 6 6" />,
  step: <path d="M9 6l6 6-6 6" />,
  play: <path d="M7 5l12 7-12 7z" fill="currentColor" />,
  pause: <path d="M8 5v14M16 5v14" strokeWidth="3" />,
}
const Icon = ({ name }: { name: keyof typeof icons }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
)

export function StatusLine({ run, playing, color }: { run: Run; playing: boolean; color: string }) {
  const status = run.status
  const text =
    status === 'halted' ? 'Halted' :
    status === 'stuck' ? `Stuck: no rule for state ${run.state} reading ${run.read(run.head)}` :
    status === 'limit' ? `Step limit reached (${run.limit.toLocaleString()}). Raise it to continue.` :
    playing ? 'Running' :
    run.steps === 0 ? 'Ready' : 'Paused'
  return (
    <div className="status" data-tour="status">
      <span className="status-ball" style={{ '--ball': color } as CSSProperties} />
      <span className="status-state">{run.state}</span>
      <span className="status-figure"><b>{run.steps.toLocaleString()}</b> {run.steps === 1 ? 'step' : 'steps'}</span>
      <span className="status-figure"><b>{run.ones().toLocaleString()}</b> {run.ones() === 1 ? 'one' : 'ones'} on tape</span>
      <span className={`status-text is-${status === 'ready' ? (playing ? 'running' : 'ready') : status}`}>{text}</span>
    </div>
  )
}

interface ControlsProps {
  run: Run
  playing: boolean
  speed: number
  onSpeed: (v: number) => void
  onStep: () => void
  onBack: () => void
  onToggle: () => void
  onReset: () => void
}

export function Controls({ run, playing, speed, onSpeed, onStep, onBack, onToggle, onReset }: ControlsProps) {
  const canRun = run.status === 'ready'
  return (
    <div className="controls" data-tour="controls">
      <button type="button" className="ctl" onClick={onReset} title="Reset (R)" aria-label="Reset">
        <Icon name="reset" />
      </button>
      <button type="button" className="ctl" onClick={onBack} disabled={!run.canStepBack} title="Step back (←)" aria-label="Step back">
        <Icon name="back" />
      </button>
      <button type="button" className="ctl ctl-main" onClick={onToggle} disabled={!playing && !canRun}
        title="Run or pause (Space)" aria-label={playing ? 'Pause' : 'Run'}>
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <button type="button" className="ctl" onClick={onStep} disabled={!canRun} title="Step (→)" aria-label="Step">
        <Icon name="step" />
      </button>
      <label className="speed">
        <span>Speed</span>
        <input type="range" min={0} max={100} value={speed} onChange={e => onSpeed(Number(e.target.value))} />
        <span className="speed-value">{stepsPerSecond(speed).toLocaleString()} steps/s</span>
      </label>
    </div>
  )
}
