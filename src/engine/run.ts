import type { Bit, Machine, Rule, RunStatus } from './types'

interface Undo {
  state: string
  head: number
  written: Bit
  lastRule: Rule | null
}

/** Oldest steps are forgotten past this point so long runs don't eat memory. */
const HISTORY_CAP = 500_000

/**
 * A running machine. Mutable on purpose: stepping millions of times must not copy the tape.
 * The UI re-renders off `steps` (and its own tick counter), not object identity.
 */
export class Run {
  readonly machine: Machine
  tape = new Map<number, Bit>()
  head: number
  state: string
  steps = 0
  lastRule: Rule | null = null
  limit: number
  private history: Undo[] = []
  private table = new Map<string, Rule>()

  constructor(machine: Machine, input: Bit[] = machine.tape) {
    this.machine = machine
    this.head = machine.startPosition
    this.state = machine.startState
    this.limit = machine.maxSteps
    input.forEach((b, i) => { if (b === 1) this.tape.set(i, 1) })
    for (const r of machine.rules) this.table.set(key(r.state, r.read), r)
  }

  read(pos: number): Bit {
    return this.tape.get(pos) ?? 0
  }

  /** The rule that would fire next, if any. */
  nextRule(): Rule | undefined {
    return this.table.get(key(this.state, this.read(this.head)))
  }

  get status(): RunStatus {
    if (this.machine.haltStates.includes(this.state)) return 'halted'
    if (!this.nextRule()) return 'stuck'
    if (this.steps >= this.limit) return 'limit'
    return 'ready'
  }

  get canStepBack(): boolean {
    return this.history.length > 0
  }

  /** Advance one step. Returns false when the machine can't move (halted, stuck or at the step limit). */
  step(): boolean {
    if (this.status !== 'ready') return false
    const rule = this.nextRule()!
    const written = this.read(this.head)
    this.history.push({ state: this.state, head: this.head, written, lastRule: this.lastRule })
    if (this.history.length > HISTORY_CAP) this.history.splice(0, HISTORY_CAP / 10)
    this.write(this.head, rule.write)
    this.head += rule.move === 'left' ? -1 : rule.move === 'right' ? 1 : 0
    this.state = rule.next
    this.lastRule = rule
    this.steps++
    return true
  }

  stepBack(): boolean {
    const undo = this.history.pop()
    if (!undo) return false
    this.write(undo.head, undo.written)
    this.head = undo.head
    this.state = undo.state
    this.lastRule = undo.lastRule
    this.steps--
    return true
  }

  /** Number of 1s on the tape. */
  ones(): number {
    return this.tape.size
  }

  /** Tape contents from the leftmost to the rightmost 1, e.g. "1101". */
  tapeString(): string {
    if (!this.tape.size) return ''
    const positions = [...this.tape.keys()]
    const lo = Math.min(...positions)
    const hi = Math.max(...positions)
    let out = ''
    for (let i = lo; i <= hi; i++) out += this.read(i)
    return out
  }

  private write(pos: number, bit: Bit) {
    if (bit === 1) this.tape.set(pos, 1)
    else this.tape.delete(pos)
  }
}

const key = (state: string, read: Bit) => `${state}\u0000${read}`
