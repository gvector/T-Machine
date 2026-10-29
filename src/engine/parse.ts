import { isMap, isScalar, isSeq, LineCounter, parseDocument, type Node } from 'yaml'
import { DEFAULT_MAX_STEPS, type Bit, type Machine, type MachineError, type Move, type ParseResult, type Rule } from './types'

const TOP_KEYS = ['name', 'description', 'tape', 'start_state', 'start_position', 'halt_states', 'max_steps', 'rules']
const RULE_KEYS = ['state', 'read', 'write', 'move', 'next']
const MOVES: Move[] = ['left', 'right', 'stay']

/** Parse a machine file. Returns every problem found, each pinned to a line where possible. */
export function parseMachine(text: string): ParseResult {
  const lineCounter = new LineCounter()
  const doc = parseDocument(text, { lineCounter, prettyErrors: false })
  const errors: MachineError[] = []

  const lineOf = (node: unknown): number | undefined => {
    const range = (node as Node | null)?.range
    return range ? lineCounter.linePos(range[0]).line : undefined
  }
  const fail = (message: string, node?: unknown) => errors.push({ message, line: lineOf(node) })

  for (const e of doc.errors) {
    errors.push({ message: e.message.split('\n')[0], line: lineCounter.linePos(e.pos[0]).line })
  }
  if (errors.length) return { ok: false, errors }

  const root = doc.contents
  if (!isMap(root)) {
    return { ok: false, errors: [{ message: 'The file must be a set of "key: value" lines (name, tape, rules, ...)', line: 1 }] }
  }

  const fields = new Map<string, { key: unknown; value: unknown }>()
  for (const pair of root.items) {
    const key = isScalar(pair.key) ? String(pair.key.value) : ''
    if (!TOP_KEYS.includes(key)) fail(`Unknown key "${key}". Allowed keys: ${TOP_KEYS.join(', ')}`, pair.key)
    else fields.set(key, { key: pair.key, value: pair.value })
  }

  /** Raw text of a plain scalar, so `tape: 0011` keeps its leading zeros. */
  const rawString = (node: unknown): string | undefined => {
    if (!isScalar(node) || node.value === null) return undefined
    if (node.type === 'PLAIN' && node.range) return text.slice(node.range[0], node.range[1])
    return String(node.value)
  }

  const str = (key: string, required: boolean): string | undefined => {
    const field = fields.get(key)
    if (!field) {
      if (required) errors.push({ message: `Missing "${key}"` })
      return undefined
    }
    const value = rawString(field.value)
    if (value === undefined || value === '') {
      if (required) fail(`"${key}" must not be empty`, field.key)
      return undefined
    }
    return value
  }

  const int = (key: string, fallback: number, min: number): number => {
    const field = fields.get(key)
    if (!field) return fallback
    const value = isScalar(field.value) ? field.value.value : undefined
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
      fail(`"${key}" must be a whole number${min > Number.MIN_SAFE_INTEGER ? ` ≥ ${min}` : ''}`, field.value ?? field.key)
      return fallback
    }
    return value
  }

  const bit = (node: unknown, what: string): Bit | undefined => {
    const value = rawString(node)
    if (value === '0' || value === '1') return Number(value) as Bit
    fail(`${what} must be 0 or 1, got "${value ?? ''}"`, node)
    return undefined
  }

  const name = str('name', false) ?? 'Untitled machine'
  const description = str('description', false) ?? ''
  const startState = str('start_state', true)
  const startPosition = int('start_position', 0, Number.MIN_SAFE_INTEGER)
  const maxSteps = int('max_steps', DEFAULT_MAX_STEPS, 1)

  const tapeText = (str('tape', false) ?? '').replace(/\s+/g, '')
  const tape: Bit[] = []
  for (const ch of tapeText) {
    if (ch !== '0' && ch !== '1') {
      fail(`"tape" may only contain 0 and 1, found "${ch}"`, fields.get('tape')?.value)
      break
    }
    tape.push(Number(ch) as Bit)
  }

  const haltStates: string[] = []
  const haltField = fields.get('halt_states')
  if (!haltField) errors.push({ message: 'Missing "halt_states" (for example: halt_states: [done])' })
  else if (isSeq(haltField.value)) {
    for (const item of haltField.value.items) {
      const value = rawString(item)
      if (value) haltStates.push(value)
      else fail('Halt state names must not be empty', item)
    }
  } else {
    const single = rawString(haltField.value)
    if (single) haltStates.push(single)
    else fail('"halt_states" must be a list, for example: [done]', haltField.key)
  }

  const rules: Rule[] = []
  const rulesField = fields.get('rules')
  if (!rulesField) errors.push({ message: 'Missing "rules"' })
  else if (!isSeq(rulesField.value)) fail('"rules" must be a list of rules', rulesField.key)
  else {
    for (const item of rulesField.value.items) {
      if (!isMap(item)) {
        fail('Each rule must look like { state: A, read: 0, write: 1, move: right, next: B }', item)
        continue
      }
      const parts = new Map<string, unknown>()
      for (const pair of item.items) {
        const key = isScalar(pair.key) ? String(pair.key.value) : ''
        if (!RULE_KEYS.includes(key)) fail(`Unknown rule key "${key}". Allowed: ${RULE_KEYS.join(', ')}`, pair.key)
        else parts.set(key, pair.value)
      }
      const missing = RULE_KEYS.filter(k => !parts.has(k))
      if (missing.length) {
        fail(`Rule is missing ${missing.map(k => `"${k}"`).join(', ')}`, item)
        continue
      }
      const state = rawString(parts.get('state'))
      const next = rawString(parts.get('next'))
      const read = bit(parts.get('read'), '"read"')
      const write = bit(parts.get('write'), '"write"')
      const move = rawString(parts.get('move')) as Move
      if (!MOVES.includes(move)) fail(`"move" must be left, right or stay, got "${move ?? ''}"`, parts.get('move'))
      if (!state) fail('"state" must not be empty', parts.get('state'))
      if (!next) fail('"next" must not be empty', parts.get('next'))
      if (state && next && read !== undefined && write !== undefined && MOVES.includes(move)) {
        rules.push({ state, read, write, move, next, line: lineOf(item) })
      }
    }
  }

  const ruleStates = new Set(rules.map(r => r.state))
  const known = (s: string) => ruleStates.has(s) || haltStates.includes(s)

  const seen = new Map<string, Rule>()
  for (const rule of rules) {
    const key = `${rule.state}\u0000${rule.read}`
    const first = seen.get(key)
    if (first) {
      errors.push({
        message: `Two rules for state "${rule.state}" reading ${rule.read} (the other is on line ${first.line})`,
        line: rule.line,
      })
    } else seen.set(key, rule)
    if (!known(rule.next)) {
      errors.push({ message: `"next: ${rule.next}" has no rules and is not a halt state`, line: rule.line })
    }
  }
  if (startState && !known(startState)) {
    fail(`start_state "${startState}" has no rules and is not a halt state`, fields.get('start_state')?.value)
  }

  if (errors.length) return { ok: false, errors }

  const states: string[] = []
  const add = (s: string) => { if (!states.includes(s)) states.push(s) }
  add(startState!)
  for (const r of rules) { add(r.state); add(r.next) }
  haltStates.forEach(add)

  const machine: Machine = {
    name, description, tape, startState: startState!, startPosition, haltStates, maxSteps, rules, states,
  }
  return { ok: true, machine }
}

/** Parse a starting-tape override typed by the user. Returns null when it contains anything but 0, 1 and spaces. */
export function parseTape(text: string): Bit[] | null {
  const clean = text.replace(/\s+/g, '')
  if (!/^[01]*$/.test(clean)) return null
  return [...clean].map(ch => Number(ch) as Bit)
}
