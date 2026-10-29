import type { Machine } from './engine/types'

const PALETTE = ['#FF7A6B', '#FFC24B', '#4FD6A6', '#5BB8FF', '#A88BFF', '#FF7EC8', '#B6E36B', '#39C5CF']
export const HALT_COLOR = '#E9EDF5'

/** A stable color per state: halt states share a pale color, the rest cycle through the palette. */
export function stateColors(machine: Machine): Map<string, string> {
  const colors = new Map<string, string>()
  let i = 0
  for (const s of machine.states) {
    colors.set(s, machine.haltStates.includes(s) ? HALT_COLOR : PALETTE[i++ % PALETTE.length])
  }
  return colors
}
