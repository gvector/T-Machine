import { useCallback, useEffect, useRef, useState } from 'react'
import { Run } from './engine/run'
import type { Bit, Machine } from './engine/types'

/** Slider position 0..100 → steps per second, on a log scale from 1 to 10,000. */
export const stepsPerSecond = (speed: number) => Math.round(10 ** (speed / 25))

/** At or below this rate every step is animated; above it the screen redraws a few times per second. */
const ANIMATED_MAX_RATE = 8
const FAST_REDRAW_MS = 100

export function useSimulator(machine: Machine, input: Bit[], limit: number, speed: number) {
  const runRef = useRef<Run | null>(null)
  const [, setTick] = useState(0)
  const [playing, setPlaying] = useState(false)
  const redraw = useCallback(() => setTick(t => t + 1), [])

  if (!runRef.current || runRef.current.machine !== machine) runRef.current = new Run(machine, input)
  const run = runRef.current
  run.limit = limit

  const reset = useCallback(() => {
    runRef.current = new Run(machine, input)
    runRef.current.limit = limit
    setPlaying(false)
    redraw()
    // input is compared by content, so re-typing the same tape doesn't reset the run
  }, [machine, input.join(''), redraw])

  // A new machine or starting tape always starts from step 0.
  useEffect(() => { reset() }, [reset])

  const rate = stepsPerSecond(speed)
  const animated = rate <= ANIMATED_MAX_RATE

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    let lastDraw = last
    let budget = 1 // take the first step right away
    const loop = (now: number) => {
      budget = Math.min(budget + ((now - last) / 1000) * rate, 50_000)
      last = now
      let moved = false
      while (budget >= 1) {
        budget--
        if (!runRef.current!.step()) {
          setPlaying(false)
          redraw()
          return
        }
        moved = true
      }
      if (moved && (animated || now - lastDraw >= FAST_REDRAW_MS)) {
        lastDraw = now
        redraw()
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(frame); redraw() }
  }, [playing, rate, animated, redraw])

  const step = useCallback(() => {
    setPlaying(false)
    if (runRef.current!.step()) redraw()
  }, [redraw])

  const stepBack = useCallback(() => {
    setPlaying(false)
    if (runRef.current!.stepBack()) redraw()
  }, [redraw])

  const togglePlay = useCallback(() => {
    setPlaying(p => !p && runRef.current!.status === 'ready')
  }, [])

  return { run, playing, animated: animated || !playing, step, stepBack, togglePlay, reset }
}
