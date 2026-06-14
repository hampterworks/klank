/**
 * @klank/audio
 *
 * Pure logic + Web Audio utilities for the metronome/tuner feature.
 * Must NOT import from @klank/ui or @klank/store.
 */

/**
 * Clamps a value between min and max (inclusive).
 * Placeholder export — real audio utilities will be added here.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Converts a BPM value to the period in milliseconds between beats.
 */
export function bpmToMs(bpm: number): number {
  if (bpm <= 0) {
    throw new RangeError(`bpm must be > 0, got ${bpm}`);
  }
  return 60_000 / bpm;
}

/**
 * Converts a MIDI note number to its frequency in Hz using A4 = 440 Hz.
 */
export function midiNoteToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}
