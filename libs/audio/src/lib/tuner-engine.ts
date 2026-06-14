/**
 * Tuner engine — framework-agnostic Web Audio reference tone player.
 *
 * AudioContext is lazily constructed on the first `playFrequency` call to
 * satisfy browser autoplay policy and to keep the engine testable in a Node
 * environment (inject a fake factory via `audioContextFactory`).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TunerEngine = {
  /**
   * Play a sine-wave reference tone at the given frequency.
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
// Factory
// ---------------------------------------------------------------------------

const DEFAULT_DURATION_S = 3;
const ATTACK_TIME_S = 0.005; // ~5 ms
const RELEASE_GAIN = 0.001;
const PEAK_GAIN = 0.6;
const FADE_OUT_S = 0.05; // short fade used by stop() to avoid clicks

/**
 * Creates a monophonic sine-tone player.
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

  // Currently sounding oscillator + gain pair (nullable).
  let currentOscillator: OscillatorNode | null = null;
  let currentGain: GainNode | null = null;

  /** Silence the current tone with a short ramp (no-op if nothing is playing). */
  function stopCurrent(): void {
    if (!ctx || !currentOscillator || !currentGain) return;

    const now = ctx.currentTime;
    currentGain.gain.cancelScheduledValues(now);
    currentGain.gain.setValueAtTime(currentGain.gain.value, now);
    currentGain.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);

    const osc = currentOscillator;
    // Capture so the closure below doesn't reference a stale variable.
    setTimeout(() => {
      try {
        osc.stop();
      } catch {
        // already stopped — ignore
      }
    }, (FADE_OUT_S + 0.01) * 1000);

    currentOscillator = null;
    currentGain = null;
  }

  return {
    playFrequency(frequencyHz: number, durationSeconds = DEFAULT_DURATION_S): void {
      const context = getContext();
      if (!context) return;

      // Stop any previous tone first.
      stopCurrent();

      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'sine';
      osc.frequency.value = frequencyHz;

      // Envelope: quick attack → exponential release
      const now = context.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(PEAK_GAIN, now + ATTACK_TIME_S);
      gain.gain.exponentialRampToValueAtTime(RELEASE_GAIN, now + durationSeconds);

      osc.connect(gain);
      gain.connect(context.destination);

      osc.start(now);
      // Stop oscillator a tiny bit after the release is complete.
      osc.stop(now + durationSeconds + 0.01);

      currentOscillator = osc;
      currentGain = gain;

      // Clear our references once the oscillator has ended naturally.
      osc.addEventListener('ended', () => {
        if (currentOscillator === osc) {
          currentOscillator = null;
          currentGain = null;
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
