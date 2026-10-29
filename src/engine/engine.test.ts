import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseMachine, parseTape } from './parse'
import { Run } from './run'
import type { Machine } from './types'

const load = (file: string): Machine => {
  const result = parseMachine(readFileSync(new URL(`../../machines/${file}`, import.meta.url), 'utf8'))
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.machine
}

const runToEnd = (run: Run) => {
  while (run.step()) { /* keep going */ }
  return run
}

describe('bundled machines', () => {
  it('Busy Beaver 3 writes six 1s in 14 steps', () => {
    const run = runToEnd(new Run(load('busy-beaver-3.yaml')))
    expect(run.status).toBe('halted')
    expect(run.steps).toBe(14)
    expect(run.ones()).toBe(6)
  })

  it('Busy Beaver 4 writes thirteen 1s in 107 steps', () => {
    const run = runToEnd(new Run(load('busy-beaver-4.yaml')))
    expect(run.status).toBe('halted')
    expect(run.steps).toBe(107)
    expect(run.ones()).toBe(13)
  })

  it('unary addition computes 3 + 2 = 5 and handles + 0', () => {
    const m = load('unary-addition.yaml')
    expect(runToEnd(new Run(m)).tapeString()).toBe('11111')
    expect(runToEnd(new Run(m, parseTape('1110')!)).tapeString()).toBe('111')
  })

  it('unary doubler doubles 1, 2 and 3', () => {
    const m = load('unary-doubler.yaml')
    for (const n of [1, 2, 3]) {
      const run = runToEnd(new Run(m, parseTape('1'.repeat(n))!))
      expect(run.status).toBe('halted')
      expect(run.tapeString()).toBe('1'.repeat(2 * n))
    }
  })
})

const tiny = (extra = '') => `
name: tiny
tape: "1"
start_state: A
halt_states: [H]
${extra}
rules:
  - { state: A, read: 1, write: 0, move: right, next: A }
  - { state: A, read: 0, write: 1, move: stay, next: H }
`

describe('Run', () => {
  it('steps back to the exact previous configuration', () => {
    const run = new Run(load('busy-beaver-4.yaml'))
    const snapshots: string[] = []
    const snap = () => `${run.state}|${run.head}|${run.steps}|${run.tapeString()}|${run.lastRule?.line}`
    while (run.status === 'ready') { snapshots.push(snap()); run.step() }
    while (run.stepBack()) expect(snap()).toBe(snapshots.pop())
    expect(run.steps).toBe(0)
    expect(run.canStepBack).toBe(false)
  })

  it('reports stuck when no rule matches', () => {
    const r = parseMachine(`
start_state: A
halt_states: [H]
rules:
  - { state: A, read: 0, write: 1, move: right, next: H }
`)
    if (!r.ok) throw new Error()
    const run = new Run(r.machine, [1])
    expect(run.status).toBe('stuck')
    expect(run.step()).toBe(false)
  })

  it('pauses at the step limit and can continue when the limit is raised', () => {
    const r = parseMachine(`
start_state: A
halt_states: [H]
max_steps: 5
rules:
  - { state: A, read: 0, write: 0, move: right, next: A }
  - { state: A, read: 1, write: 1, move: right, next: H }
`)
    if (!r.ok) throw new Error()
    const run = runToEnd(new Run(r.machine))
    expect(run.status).toBe('limit')
    expect(run.steps).toBe(5)
    run.limit = 10
    expect(run.step()).toBe(true)
  })

  it('moves left into negative positions', () => {
    const r = parseMachine(`
start_state: A
halt_states: [H]
rules:
  - { state: A, read: 0, write: 1, move: left, next: B }
  - { state: B, read: 0, write: 1, move: left, next: H }
`)
    if (!r.ok) throw new Error()
    const run = runToEnd(new Run(r.machine))
    expect(run.head).toBe(-2)
    expect([...run.tape.keys()].sort()).toEqual([-1, 0])
  })
})

describe('parseMachine', () => {
  const errorsOf = (text: string) => {
    const r = parseMachine(text)
    return r.ok ? [] : r.errors
  }

  it('accepts a valid machine and fills defaults', () => {
    const r = parseMachine(tiny())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.machine.startPosition).toBe(0)
    expect(r.machine.maxSteps).toBe(10_000)
    expect(r.machine.states).toEqual(['A', 'H'])
    expect(r.machine.rules[0].line).toBe(8)
  })

  it('keeps leading zeros of an unquoted tape', () => {
    const r = parseMachine(tiny().replace('tape: "1"', 'tape: 0011'))
    expect(r.ok && r.machine.tape).toEqual([0, 0, 1, 1])
  })

  it('reports YAML syntax errors with a line', () => {
    const [e] = errorsOf('name: x\nrules: [ {')
    expect(e.line).toBeGreaterThan(0)
  })

  it('reports bad symbols, moves and unknown keys with their lines', () => {
    const errors = errorsOf(`
start_state: A
halt_states: [H]
blank: 0
rules:
  - { state: A, read: 2, write: 1, move: up, next: H }
`)
    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ line: 4, message: expect.stringContaining('Unknown key "blank"') }),
      expect.objectContaining({ line: 6, message: expect.stringContaining('"read" must be 0 or 1') }),
      expect.objectContaining({ line: 6, message: expect.stringContaining('"move" must be left, right or stay') }),
    ]))
  })

  it('reports duplicate rules and unknown next states', () => {
    const errors = errorsOf(`
start_state: A
halt_states: [H]
rules:
  - { state: A, read: 0, write: 1, move: right, next: H }
  - { state: A, read: 0, write: 0, move: left, next: Nowhere }
`)
    expect(errors.map(e => e.message)).toEqual(expect.arrayContaining([
      expect.stringContaining('Two rules for state "A" reading 0 (the other is on line 5)'),
      expect.stringContaining('"next: Nowhere" has no rules'),
    ]))
  })

  it('reports missing required keys', () => {
    const messages = errorsOf('name: nothing').map(e => e.message)
    expect(messages).toEqual(expect.arrayContaining([
      'Missing "start_state"', expect.stringContaining('Missing "halt_states"'), 'Missing "rules"',
    ]))
  })

  it('rejects non-binary tapes', () => {
    expect(errorsOf(tiny().replace('tape: "1"', 'tape: "1X1"'))[0].message).toContain('only contain 0 and 1')
    expect(parseTape('1 0 1')).toEqual([1, 0, 1])
    expect(parseTape('12')).toBeNull()
  })
})
