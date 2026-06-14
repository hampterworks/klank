/**
 * Metronome engine — framework-agnostic Chris Wilson look-ahead scheduler.
 *
 * AudioContext is lazily constructed on the first `start()` call (browser
 * autoplay policy + testability via injected factory).
 */

import {
  beatPattern,
  nextPulseTime,
  type BeatKind,
  type Subdivision,
} from './metronome-schedule.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MetronomeConfig = {
  bpm: number;
  timeSignatureTop: number;
  subdivision: Subdivision;
  /** When false, the downbeat uses the normal 'beat' tone instead of accent. */
  accent: boolean;
};

export type TickInfo = {
  index: number;
  kind: BeatKind;
};

export type MetronomeEngine = {
  start(config: MetronomeConfig, onTick?: (info: TickInfo) => void): void;
  /** Apply partial config changes live — effective from the next pulse. */
  setConfig(partial: Partial<MetronomeConfig>): void;
  stop(): void;
  isRunning(): boolean;
  isAvailable(): boolean;
  dispose(): void;
};

// ---------------------------------------------------------------------------
// Tone parameters
// ---------------------------------------------------------------------------

const ACCENT_FREQ = 1320;
const BEAT_FREQ = 880;
const SUB_FREQ = 440;

const ACCENT_GAIN = 0.8;
const BEAT_GAIN = 0.5;
const SUB_GAIN = 0.25;

/** Duration of each scheduled click in seconds. */
const CLICK_DURATION_S = 0.03;

/** How far ahead we schedule, in seconds. */
const SCHEDULE_AHEAD_S = 0.1;

/** Scheduler poll interval in milliseconds. */
const SCHEDULER_INTERVAL_MS = 25;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a look-ahead metronome engine.
 *
 * @param audioContextFactory  Optional factory; defaults to `window.AudioContext`
 *                             (or `webkitAudioContext`).
 */
export function createMetronomeEngine(
  audioContextFactory?: () => AudioContext,
): MetronomeEngine {
  const factory: () => AudioContext =
    audioContextFactory ??
    (() =>
      new (
        (window as Window & typeof globalThis).AudioContext ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext
      )());

  let ctx: AudioContext | null = null;
  let available: boolean | null = null;

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

  // ---------------------------------------------------------------------------
  // Scheduler state
  // ---------------------------------------------------------------------------

  let running = false;
  let schedulerIntervalId: ReturnType<typeof setInterval> | null = null;

  /** Mutable live config — reads are always current inside the scheduler. */
  let config: MetronomeConfig = {
    bpm: 120,
    timeSignatureTop: 4,
    subdivision: 1,
    accent: true,
  };

  /** Absolute AudioContext time of the next pulse to schedule. */
  let nextPulseAudioTime = 0;

  /** 0-based pulse index within the current bar pattern. */
  let pulseIndex = 0;

  /** Beat pattern for the current bar (rebuilt whenever top/subdivision changes). */
  let pattern: BeatKind[] = [];

  /** Last known pattern key to detect when pattern must be rebuilt. */
  let patternKey = '';

  let onTickCallback: ((info: TickInfo) => void) | undefined;

  // Collection of pending onTick setTimeout IDs so we can cancel on stop.
  const pendingTickTimeouts = new Set<ReturnType<typeof setTimeout>>();

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getPattern(): BeatKind[] {
    const key = `${config.timeSignatureTop}:${config.subdivision}`;
    if (key !== patternKey) {
      pattern = beatPattern(config.timeSignatureTop, config.subdivision);
      patternKey = key;
      // Keep pulseIndex in bounds.
      pulseIndex = pulseIndex % pattern.length;
    }
    return pattern;
  }

  /** Schedule a single Web Audio click at `audioTime`. */
  function scheduleClick(audioTime: number, kind: BeatKind, effectiveAccent: boolean): void {
    if (!ctx) return;

    // When accent is disabled, treat the downbeat as a normal 'beat'.
    const effectiveKind: BeatKind =
      kind === 'accent' && !effectiveAccent ? 'beat' : kind;

    let freq: number;
    let gainValue: number;

    switch (effectiveKind) {
      case 'accent':
        freq = ACCENT_FREQ;
        gainValue = ACCENT_GAIN;
        break;
      case 'beat':
        freq = BEAT_FREQ;
        gainValue = BEAT_GAIN;
        break;
      default:
        freq = SUB_FREQ;
        gainValue = SUB_GAIN;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(gainValue, audioTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioTime + CLICK_DURATION_S);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(audioTime);
    osc.stop(audioTime + CLICK_DURATION_S + 0.001);
  }

  /** Schedule an onTick callback to fire when the audio clock reaches `audioTime`. */
  function scheduleTickCallback(
    audioTime: number,
    index: number,
    kind: BeatKind,
    effectiveAccent: boolean,
  ): void {
    if (!onTickCallback || !ctx) return;

    const effectiveKind: BeatKind =
      kind === 'accent' && !effectiveAccent ? 'beat' : kind;

    const delayMs = Math.max(0, (audioTime - ctx.currentTime) * 1000);
    const cb = onTickCallback; // capture ref in case it changes
    const id = setTimeout(() => {
      pendingTickTimeouts.delete(id);
      cb({ index, kind: effectiveKind });
    }, delayMs);
    pendingTickTimeouts.add(id);
  }

  /** The core look-ahead scheduling function, called every SCHEDULER_INTERVAL_MS. */
  function schedule(): void {
    if (!ctx) return;

    const currentPattern = getPattern();
    const lookAheadUntil = ctx.currentTime + SCHEDULE_AHEAD_S;
    const { bpm, subdivision, accent } = config;

    // Catch-up clamp: if the scheduler was throttled (e.g. background tab) and
    // nextPulseAudioTime has fallen well behind ctx.currentTime, re-anchor it
    // to now so we never schedule a burst of past-dated clicks on resume.
    // We only clamp when the lag exceeds several look-ahead windows so that
    // fast subdivisions (whose next pulse may land just behind currentTime
    // between normal ticks) are scheduled without an artificial gap.
    if (nextPulseAudioTime < ctx.currentTime - 3 * SCHEDULE_AHEAD_S) {
      nextPulseAudioTime = ctx.currentTime;
    }

    while (nextPulseAudioTime < lookAheadUntil) {
      const kind = currentPattern[pulseIndex];

      scheduleClick(nextPulseAudioTime, kind, accent);
      scheduleTickCallback(nextPulseAudioTime, pulseIndex, kind, accent);

      // Advance to next pulse.
      nextPulseAudioTime = nextPulseTime(nextPulseAudioTime, bpm, subdivision);
      pulseIndex = (pulseIndex + 1) % currentPattern.length;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    start(cfg: MetronomeConfig, onTick?: (info: TickInfo) => void): void {
      // Stop any existing run first.
      if (running) {
        this.stop();
      }

      const context = getContext();
      if (!context) return;

      config = { ...cfg };
      onTickCallback = onTick;

      // Reset pattern state.
      patternKey = '';
      pulseIndex = 0;
      getPattern(); // prime the pattern

      // Start slightly ahead of the current audio time.
      nextPulseAudioTime = context.currentTime;

      running = true;

      // Run the scheduler immediately, then on the interval.
      schedule();
      schedulerIntervalId = setInterval(schedule, SCHEDULER_INTERVAL_MS);
    },

    setConfig(partial: Partial<MetronomeConfig>): void {
      config = { ...config, ...partial };
      // Pattern will be rebuilt on next schedule() call if top/subdivision changed.
    },

    stop(): void {
      running = false;
      if (schedulerIntervalId !== null) {
        clearInterval(schedulerIntervalId);
        schedulerIntervalId = null;
      }
      // Cancel any pending onTick callbacks.
      for (const id of pendingTickTimeouts) {
        clearTimeout(id);
      }
      pendingTickTimeouts.clear();
      onTickCallback = undefined;
    },

    isRunning(): boolean {
      return running;
    },

    isAvailable(): boolean {
      if (available === null) {
        getContext();
      }
      return available === true;
    },

    dispose(): void {
      this.stop();
      if (ctx) {
        ctx.close().catch(() => undefined);
        ctx = null;
      }
      // Permanently latch the engine dead so getContext() never rebuilds a context.
      available = false;
    },
  };
}
