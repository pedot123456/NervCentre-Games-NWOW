/**
 * Synthesised sound effects (Web Audio) – no audio files to load.
 * Browsers only allow audio after a user gesture, so `unlock()` runs on the first tap.
 */
import { createStore, readLocal, writeLocal } from './store'

const MUTE_KEY = 'wr.muted.v1'
export const mutedStore = createStore<boolean>(readLocal<boolean | null>(MUTE_KEY, null) ?? false, (v) => writeLocal(MUTE_KEY, v))

/** Applies the event default (Admin setting) unless someone already chose on this device. */
export function applySoundDefault(enabled: boolean) {
  if (readLocal<boolean | null>(MUTE_KEY, null) === null) mutedStore.set(!enabled)
}

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (mutedStore.get()) return null
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

interface Tone {
  freq: number
  at?: number
  dur?: number
  type?: OscillatorType
  gain?: number
  to?: number
}

function play(tones: Tone[]) {
  const ac = audio()
  if (!ac) return
  const now = ac.currentTime
  for (const t of tones) {
    const start = now + (t.at ?? 0)
    const dur = t.dur ?? 0.12
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = t.type ?? 'sine'
    osc.frequency.setValueAtTime(t.freq, start)
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + dur)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(t.gain ?? 0.16, start + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(g).connect(ac.destination)
    osc.start(start)
    osc.stop(start + dur + 0.05)
  }
}

export const sfx = {
  unlock: () => audio(),
  tap: () => play([{ freq: 700, dur: 0.05, type: 'triangle', gain: 0.07 }]),
  /** A solution built – a bright chime. */
  chime: () =>
    play([
      { freq: 784, dur: 0.14, type: 'sine', gain: 0.16 },
      { freq: 1175, at: 0.07, dur: 0.18, type: 'sine', gain: 0.13 },
      { freq: 1568, at: 0.14, dur: 0.32, type: 'sine', gain: 0.1 },
    ]),
  wrong: () => play([{ freq: 220, dur: 0.24, type: 'sawtooth', gain: 0.07, to: 150 }]),
  skip: () => play([{ freq: 520, dur: 0.08, type: 'triangle', gain: 0.08 }, { freq: 390, at: 0.07, dur: 0.12, type: 'triangle', gain: 0.08 }]),
  tick: () => play([{ freq: 1250, dur: 0.035, type: 'square', gain: 0.045 }]),
  count: () => play([{ freq: 523, dur: 0.16, type: 'sine', gain: 0.2 }]),
  go: () => play([{ freq: 784, dur: 0.12, type: 'triangle' }, { freq: 1046, at: 0.1, dur: 0.32, type: 'triangle' }]),
  timeUp: () => play([{ freq: 440, dur: 0.16, type: 'square', gain: 0.06 }, { freq: 330, at: 0.18, dur: 0.34, type: 'square', gain: 0.06 }]),
  /** Full constellation lit. */
  reveal: () =>
    play([
      { freq: 523, dur: 0.16, type: 'triangle' },
      { freq: 659, at: 0.12, dur: 0.16, type: 'triangle' },
      { freq: 784, at: 0.24, dur: 0.16, type: 'triangle' },
      { freq: 1046, at: 0.38, dur: 0.6, type: 'triangle' },
      { freq: 1568, at: 0.5, dur: 0.6, type: 'sine', gain: 0.08 },
    ]),
  star: () => play([{ freq: 1320, dur: 0.1, type: 'sine', gain: 0.08 }, { freq: 1760, at: 0.05, dur: 0.16, type: 'sine', gain: 0.06 }]),
  join: () => play([{ freq: 660, dur: 0.1, type: 'triangle', gain: 0.1 }, { freq: 990, at: 0.08, dur: 0.16, type: 'triangle', gain: 0.1 }]),
}
