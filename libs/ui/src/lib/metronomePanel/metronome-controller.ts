/**
 * Module-level metronome singleton — the engine and the user's settings live
 * for the whole app session so the metronome keeps running (and remembers its
 * configuration) when the panel popover unmounts.
 */

import {
  createMetronomeEngine,
  type MetronomeConfig,
  type MetronomeEngine,
  type TickInfo,
} from '@klank/audio'

export type SubdivisionLabel = 'quarter' | 'eighth' | 'triplet'

export type MetronomeSession = {
  bpm: number
  timeSignatureNum: number
  timeSignatureDen: number
  accentDownbeat: boolean
  subdivision: SubdivisionLabel
}

const DEFAULT_SESSION: MetronomeSession = {
  bpm: 120,
  timeSignatureNum: 4,
  timeSignatureDen: 4,
  accentDownbeat: true,
  subdivision: 'quarter',
}

/** Session-level settings memory — survives panel unmount, not persisted. */
export const metronomeSession: MetronomeSession = { ...DEFAULT_SESSION }

let engine: MetronomeEngine | null = null
let tickListener: ((info: TickInfo) => void) | null = null

/** Idempotent: the first call creates the shared engine (factory injectable for tests). */
export const acquireMetronomeEngine = (
  factory: () => MetronomeEngine = createMetronomeEngine
): MetronomeEngine => {
  if (engine === null) engine = factory()
  return engine
}

/**
 * Start via the controller so ticks route through a stable forwarding closure —
 * the panel can attach/detach its listener across mounts while the engine runs.
 */
export const startMetronome = (config: MetronomeConfig): void => {
  engine?.start(config, (info) => tickListener?.(info))
}

export const setMetronomeTickListener = (
  listener: ((info: TickInfo) => void) | null
): void => {
  tickListener = listener
}

/** Test-only: dispose the shared engine and reset the session defaults. */
export const resetMetronomeController = (): void => {
  engine?.dispose()
  engine = null
  tickListener = null
  Object.assign(metronomeSession, DEFAULT_SESSION)
}
