import dagre from '@dagrejs/dagre'
import {
  applyNodeChanges, Background, BaseEdge, EdgeLabelRenderer, Handle, MarkerType, Position, ReactFlow,
  useInternalNode, type Edge, type EdgeProps, type Node, type NodeChange, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Machine, Rule } from '../engine/types'

const BALL = 64
const R = BALL / 2
const IDLE_ARROW = '#5C6680'

type Pt = { x: number; y: number }
/** Where the auto-layout routed an arrow, so it bends around other balls instead of through them. */
type Route = { points: Pt[]; label: Pt }

type BallData = { label: string; color: string; current: boolean; halt: boolean; start: boolean }
type ArrowData = { rules: Rule[]; fired: Rule | null; color: string; curve: number; route?: Route }
type BallNode = Node<BallData, 'ball'>
type ArrowEdge = Edge<ArrowData, 'arrow'>

const moveLetter = { left: 'L', right: 'R', stay: 'S' } as const
export const ruleLabel = (r: Rule) => `${r.read} → ${r.write}, ${moveLetter[r.move]}`

function Ball({ data }: NodeProps<BallNode>) {
  return (
    <div
      className={`ball${data.current ? ' is-current' : ''}${data.halt ? ' is-halt' : ''}`}
      style={{ '--ball': data.color } as CSSProperties}
      title={data.halt ? `${data.label} (halt state)` : data.label}
    >
      {data.start && <span className="ball-start" aria-label="start state" />}
      <span className="ball-label" style={{ fontSize: labelSize(data.label) }}>{data.label}</span>
      <Handle type="target" position={Position.Top} className="ball-handle" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} className="ball-handle" isConnectable={false} />
    </div>
  )
}

/** Shrink long state names so they still fit inside the ball. */
const labelSize = (label: string) => (label.length <= 3 ? 15 : label.length <= 5 ? 13 : label.length <= 7 ? 11.5 : 10)

function center(node: ReturnType<typeof useInternalNode>): Pt {
  const p = node!.internals.positionAbsolute
  return { x: p.x + (node!.measured.width ?? BALL) / 2, y: p.y + (node!.measured.height ?? BALL) / 2 }
}

/** Point on a ball's rim, facing `toward`. */
function rim(c: Pt, toward: Pt, gap: number): Pt {
  const dx = toward.x - c.x
  const dy = toward.y - c.y
  const l = Math.hypot(dx, dy) || 1
  return { x: c.x + (dx / l) * (R + gap), y: c.y + (dy / l) * (R + gap) }
}

/** Smooth curve through the routed points. */
function smooth(points: Pt[]): string {
  let d = `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) return `${d} L ${points[1].x} ${points[1].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const end = i < points.length - 2
      ? { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 }
      : points[i + 1]
    d += ` Q ${points[i].x} ${points[i].y} ${end.x} ${end.y}`
  }
  return d
}

/** Arrow between two balls. Follows the layout's route; once a ball is dragged, falls back to a simple curve. */
function Arrow({ id, source, target, data, markerEnd }: EdgeProps<ArrowEdge>) {
  const s = useInternalNode(source)
  const t = useInternalNode(target)
  if (!s || !t || !data) return null
  const a = center(s)
  const b = center(t)
  const lit = data.fired !== null

  let path: string
  let label: Pt
  if (source === target) {
    // A loop leaving and re-entering the ball, pointing at the spot the layout kept free for its label.
    label = data.route?.label ?? { x: a.x, y: a.y - 90 }
    const angle = Math.atan2(label.y - a.y, label.x - a.x)
    const reach = Math.max(70, (Math.hypot(label.x - a.x, label.y - a.y) - 8) / 0.62)
    const at = (r: number, da: number) => ({ x: a.x + r * Math.cos(angle + da), y: a.y + r * Math.sin(angle + da) })
    const [p1, c1, c2, p2] = [at(R + 2, -0.5), at(reach, -0.6), at(reach, 0.6), at(R + 4, 0.5)]
    path = `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`
  } else if (data.route) {
    const pts = [...data.route.points]
    pts[0] = rim(a, pts[1], 2)
    pts[pts.length - 1] = rim(b, pts[pts.length - 2], 4)
    path = smooth(pts)
    label = data.route.label
  } else {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const c = { x: (a.x + b.x) / 2 - (dy / len) * data.curve, y: (a.y + b.y) / 2 + (dx / len) * data.curve }
    const p1 = rim(a, c, 2)
    const p2 = rim(b, c, 4)
    path = `M ${p1.x} ${p1.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`
    label = { x: 0.25 * p1.x + 0.5 * c.x + 0.25 * p2.x, y: 0.25 * p1.y + 0.5 * c.y + 0.25 * p2.y }
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={lit ? 'arrow is-lit' : 'arrow'}
        style={{ '--ball': data.color } as CSSProperties} />
      <EdgeLabelRenderer>
        <div className={`arrow-label${lit ? ' is-lit' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)`, '--ball': data.color } as CSSProperties}>
          {data.rules.map(r => (
            <div key={r.read} className={r === data.fired ? 'is-fired' : undefined}>{ruleLabel(r)}</div>
          ))}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const nodeTypes = { ball: Ball }
const edgeTypes = { arrow: Arrow }

/** Rules grouped into one arrow per (from, to) pair, keyed "from\0to". */
function groupRules(machine: Machine): Map<string, Rule[]> {
  const groups = new Map<string, Rule[]>()
  for (const r of machine.rules) {
    const k = `${r.state}\u0000${r.next}`
    groups.set(k, [...(groups.get(k) ?? []), r].sort((x, y) => x.read - y.read))
  }
  return groups
}

type Direction = 'LR' | 'TB'

function layout(machine: Machine, groups: Map<string, Rule[]>, direction: Direction) {
  const g = new dagre.graphlib.Graph()
  // labels sit in their own rank between balls, so ranksep is only half the gap you see
  g.setGraph({ rankdir: direction, nodesep: 50, ranksep: 40, edgesep: 24, marginx: 20, marginy: 20 })
  for (const s of machine.states) g.setNode(s, { width: BALL, height: BALL })
  for (const [k, rules] of groups) {
    const [from, to] = k.split('\u0000')
    // labels get real space in the layout so they don't sit on top of balls or each other
    g.setEdge(from, to, { width: 76, height: rules.length * 18 + 8, labelpos: 'c' })
  }
  dagre.layout(g)
  const at: Record<string, Pt> = {}
  for (const s of machine.states) {
    const n = g.node(s)
    at[s] = { x: n.x - R, y: n.y - R }
  }
  const routes = new Map<string, Route>()
  for (const k of groups.keys()) {
    const [from, to] = k.split('\u0000')
    const e = g.edge(from, to)
    if (e?.points?.length >= 2 && e.x !== undefined) routes.set(k, { points: e.points, label: { x: e.x, y: e.y! } })
  }
  return { at, routes }
}

interface Props {
  machine: Machine
  colors: Map<string, string>
  state: string
  fired: Rule | null
  animated: boolean
}

/**
 * The layout is redone only when the shape of the graph changes, so editing a write or move keeps balls in place.
 * It flows left to right in wide boxes and top to bottom in tall ones (phones).
 */
export function Diagram(props: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [direction, setDirection] = useState<Direction>('LR')
  const [tidyCount, setTidyCount] = useState(0)
  const groups = useMemo(() => groupRules(props.machine), [props.machine])
  const shape = [...props.machine.states, ...[...groups].map(([k, rs]) => `${k}:${rs.length}`)].join('\u0001')

  useEffect(() => {
    const el = box.current!
    const observer = new ResizeObserver(() => {
      if (el.clientWidth && el.clientHeight) setDirection(el.clientHeight > el.clientWidth ? 'TB' : 'LR')
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={box} className={`diagram${props.animated ? '' : ' is-fast'}`} data-tour="diagram">
      <DiagramFlow key={`${shape}#${direction}#${tidyCount}`} {...props} groups={groups} direction={direction}
        onTidy={() => setTidyCount(n => n + 1)} />
    </div>
  )
}

function DiagramFlow({ machine, colors, state, fired, groups, direction, onTidy }: Props & {
  groups: Map<string, Rule[]>
  direction: Direction
  onTidy: () => void
}) {
  const [{ at, routes }] = useState(() => layout(machine, groups, direction))
  // Nodes live in state so React Flow keeps their measured size and dragged position between renders.
  const [placed, setPlaced] = useState<BallNode[]>(() =>
    machine.states.map(s => ({ id: s, type: 'ball', position: at[s], data: ballData(s) })))
  const [dragged, setDragged] = useState<Set<string>>(() => new Set())

  function ballData(s: string): BallData {
    return {
      label: s,
      color: colors.get(s)!,
      current: s === state,
      halt: machine.haltStates.includes(s),
      start: s === machine.startState,
    }
  }
  const nodes = placed.map(n => ({ ...n, data: ballData(n.id) }))

  const edges: ArrowEdge[] = [...groups.entries()].map(([k, rules]) => {
    const [from, to] = k.split('\u0000')
    const hit = rules.find(r => r === fired) ?? null
    const color = hit ? colors.get(from)! : IDLE_ARROW
    const free = !dragged.has(from) && !dragged.has(to)
    return {
      id: k,
      source: from,
      target: to,
      type: 'arrow',
      data: {
        rules, fired: hit, color,
        curve: from !== to && groups.has(`${to}\u0000${from}`) ? 36 : 14,
        route: free ? routes.get(k) : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
      zIndex: hit ? 1 : 0,
    }
  })

  const onNodesChange = (changes: NodeChange<BallNode>[]) => {
    const moved = changes.filter(c => c.type === 'position' && c.dragging).map(c => (c as { id: string }).id)
    if (moved.some(id => !dragged.has(id))) setDragged(d => new Set([...d, ...moved]))
    setPlaced(ns => applyNodeChanges(changes, ns))
  }

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background gap={24} size={1} color="#2A3348" />
      </ReactFlow>
      {dragged.size > 0 && <button type="button" className="btn diagram-tidy" onClick={onTidy}>Tidy up</button>}
    </>
  )
}
