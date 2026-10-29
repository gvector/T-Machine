import type { CSSProperties } from 'react'
import type { Run } from '../engine/run'

const PITCH = 48 // tile width + gap, keep in sync with --tile in index.css
const REACH = 20 // tiles rendered on each side of the head; the viewport shows ~25

interface Props {
  run: Run
  color: string
  animated: boolean
}

/** The tape slides under a fixed head, so the head always sits in the middle of the view. */
export function Tape({ run, color, animated }: Props) {
  const cells = []
  for (let i = run.head - REACH; i <= run.head + REACH; i++) {
    const bit = run.read(i)
    cells.push(
      <div key={i} className="cell" style={{ left: i * PITCH }}>
        <div className={`tile${bit ? ' is-one' : ''}${i === run.head ? ' is-head' : ''}`} aria-label={`position ${i}: ${bit}`} />
        <div className="ruler">{i}</div>
      </div>,
    )
  }
  return (
    <div className={`tape${animated ? '' : ' is-fast'}`} data-tour="tape" style={{ '--ball': color } as CSSProperties}>
      <div className="head" aria-hidden="true" />
      <div className="tape-rail" />
      <div className="tape-track" style={{ transform: `translateX(${-run.head * PITCH - PITCH / 2}px)` }}>
        {cells}
      </div>
    </div>
  )
}
