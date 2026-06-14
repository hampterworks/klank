/**
 * Tuner engine — framework-agnostic Web Audio reference tone player.
 *
 * AudioContext is lazily constructed on the first `playFrequency` call to
 * satisfy browser autoplay policy and to keep the engine testable in a Node
 * environment (inject a fake factory via `audioContextFactory`).
 *
 * Tone design: each note is synthesised as a sum of harmonic partials
 * (f, 2f, 3f, 4f) with decreasing gain to produce a bright, guitar-like
 * timbre.  The master envelope is a near-instant attack followed by an
 * exponential decay over the full duration (plucked-string behaviour).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TunerEngine = {
  /**
   * Play a guitar-like reference tone at the given frequency.
   * If a tone is already playing, it is stopped first (monophonic).
   *
   * @param frequencyHz   Target frequency in Hz.
   * @param durationSeconds  How long the tone lasts (default 3 s).
   */
  playFrequency(frequencyHz: number, durationSeconds?: number): void;

  /** Immediately silence any sounding tone with a short fade to avoid clicks. */
  stop(): void;

  /** Returns false when Web Audio is unavailable (SSR / old WebView). */
  isAvailable(): boolean;

  /** Stop any sounding tone and close the AudioContext. */
  dispose(): void;
};

// ---------------------------------------------------------------------------
// Harmonic partial definitions
// ---------------------------------------------------------------------------

/**
 * Each partial is defined as a multiplier on the fundamental frequency and a
 * relative gain (0–1).  The gain values are chosen to mimic a plucked string:
 * fundamental loudest, upper harmonics progressively quieter.
 */
const PARTIALS: ReadonlyArray<{ multiple: number; relativeGain: number }> = [
  { multiple: 1, relativeGain: 1.0 },   // fundamental
  { multiple: 2, relativeGain: 0.5 },   // 2nd harmonic
  { multiple: 3, relativeGain: 0.25 },  // 3rd harmonic
  { multiple: 4, relativeGain: 0.125 }, // 4th harmonic
];

// ---------------------------------------------------------------------------
// Envelope constants
// ---------------------------------------------------------------------------

const DEFAULT_DURATION_S = 3;
const ATTACK_TIME_S = 0.005; // ~5 ms near-instant attack
const RELEASE_GAIN = 0.001;  // exponential decay target (near-zero)

/**
 * Master peak gain is normalised so the sum of all partials at peak does not
 * exceed a comfortable output level.  Total relative gain = 1 + 0.5 + 0.25 +
 * 0.125 = 1.875; scaling by (0.6 / 1.875) keeps the overall peak ≈ 0.6.
 */
const MASTER_PEAK_GAIN = 0.6;
const TOTAL_RELATIVE_GAIN = PARTIALS.reduce((s, p) => s + p.relativeGain, 0);

const FADE_OUT_S = 0.05; // short fade used by stop() to avoid clicks

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a monophonic, guitar-like reference tone player.
 *
 * @param audioContextFactory  Optional factory; defaults to `window.AudioContext`
 *                             (or `webkitAudioContext`).
 */
export function createTunerEngine(
  audioContextFactory?: () => AudioContext,
): TunerEngine {
  const factory: () => AudioContext =
    audioContextFactory ??
    (() =>
      new (
        (window as Window & typeof globalThis).AudioContext ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext
      )());

  let ctx: AudioContext | null = null;
  let available: boolean | null = null; // null = not yet determined

  /** Lazily initialise the AudioContext; sets `available` as a side-effect. */
  function getContext(): AudioContext | null {
    if (available === false) return null;
    if (ctx !== null) return ctx;
    try {
      ctx = factory();
      available = true;
      return ctx;
    } catch {
      available = false;
      return null;
    }
  }

  // Currently sounding set of oscillators + per-partial gains (nullable).
  let currentOscillators: OscillatorNode[] = [];
  let currentGains: GainNode[] = [];

  /** Silence the current tone with a short ramp (no-op if nothing is playing). */
  function stopCurrent(): void {
    if (!ctx || currentOscillators.length === 0) return;

    const now = ctx.currentTime;

    for (const gain of currentGains) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
    }

    const oscs = currentOscillators.slice();
    // Capture so the closure below doesn't reference stale variables.
    setTimeout(() => {
      for (const osc of oscs) {
        try {
          osc.stop();
        } catch {
          // already stopped — ignore
        }
      }
    }, (FADE_OUT_S + 0.01) * 1000);

    currentOscillators = [];
    currentGains = [];
  }

  return {
    playFrequency(frequencyHz: number, durationSeconds = DEFAULT_DURATION_S): void {
      const context = getContext();
      if (!context) return;

      // Stop any previous tone first (monophonic).
      stopCurrent();

      const now = context.currentTime;
      const newOscillators: OscillatorNode[] = [];
      const newGains: GainNode[] = [];

      for (const partial of PARTIALS) {
        const osc = context.createOscillator();
        const gain = context.createGain();

        osc.type = 'sine';
        osc.frequency.value = frequencyHz * partial.multiple;

        // Per-partial peak gain, normalised to the master level.
        const peakGain =
          (partial.relativeGain / TOTAL_RELATIVE_GAIN) * MASTER_PEAK_GAIN;

        // Plucked-string envelope: near-instant attack → exponential decay.
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(peakGain, now + ATTACK_TIME_S);
        gain.gain.exponentialRampToValueAtTime(RELEASE_GAIN, now + durationSeconds);

        osc.connect(gain);
        gain.connect(context.destination);

        osc.start(now);
        // Stop each oscillator a tiny bit after the release completes.
        osc.stop(now + durationSeconds + 0.01);

        newOscillators.push(osc);
        newGains.push(gain);
      }

      currentOscillators = newOscillators;
      currentGains = newGains;

      // Clear our references once the fundamental oscillator has ended naturally.
      const fundamental = newOscillators[0];
      fundamental.addEventListener('ended', () => {
        if (currentOscillators[0] === fundamental) {
          currentOscillators = [];
          currentGains = [];
        }
      });
    },

    stop(): void {
      stopCurrent();
    },

    isAvailable(): boolean {
      // If we haven't tried yet, attempt to build the context.
      if (available === null) {
        getContext();
      }
      return available === true;
    },

    dispose(): void {
      stopCurrent();
      if (ctx) {
        ctx.close().catch(() => undefined);
        ctx = null;
      }
      // Permanently latch the engine dead so getContext() never rebuilds a context.
      available = false;
    },
  };
}
