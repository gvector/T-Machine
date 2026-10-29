export type Bit = 0 | 1
export type Move = 'left' | 'right' | 'stay'

export interface Rule {
  state: string
  read: Bit
  write: Bit
  move: Move
  next: string
  /** 1-based line in the source file, when known. */
  line?: number
}

export interface Machine {
  name: string
  description: string
  tape: Bit[]
  startState: string
  startPosition: number
  haltStates: string[]
  maxSteps: number
  rules: Rule[]
  /** Every state in order of first appearance (start state first). */
  states: string[]
}

export interface MachineError {
  message: string
  /** 1-based line, when the error can be pinned to one. */
  line?: number
}

export type ParseResult =
  | { ok: true; machine: Machine }
  | { ok: false; errors: MachineError[] }

/** Engine status. `running`/`paused` are UI concerns layered on top. */
export type RunStatus = 'ready' | 'halted' | 'stuck' | 'limit'

export const DEFAULT_MAX_STEPS = 10_000
