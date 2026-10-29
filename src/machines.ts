import { parseMachine } from './engine/parse'

export interface BundledMachine {
  id: string
  name: string
  text: string
}

const files = import.meta.glob('/machines/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/** Every .yaml in the machines/ folder, picked up automatically at build time. */
export const bundled: BundledMachine[] = Object.entries(files)
  .map(([path, text]) => {
    const id = path.split('/').pop()!
    const parsed = parseMachine(text)
    return { id, text, name: parsed.ok ? parsed.machine.name : id }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

export const findBundled = (id: string) => bundled.find(m => m.id === id)
