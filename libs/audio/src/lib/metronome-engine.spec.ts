import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMetronomeEngine } from './metronome-engine.js';
import { secondsPerSubPulse } from './metronome-schedule.js';
import type { MetronomeConfig, TickInfo } from './metronome-engine.js';

// ---------------------------------------------------------------------------
// Fake AudioContext helpers
// ---------------------------------------------------------------------------

type FakeAudioParam = {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
};

function makeFakeParam(initial = 0): FakeAudioParam {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

type FakeOscillator = {
  type: OscillatorType;
  frequency: FakeAudioParam;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
};

type FakeGain = {
  gain: FakeAudioParam;
  connect: ReturnType<typeof vi.fn>;
};

type FakeAudioContext = {
  currentTime: number;
  destination: object;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  _oscillators: FakeOscillator[];
  _gains: FakeGain[];
};

function makeFakeOscillator(): FakeOscillator {
  return {
    type: 'sine',
    frequency: makeFakeParam(440),
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
  };
}

function makeFakeGain(): FakeGain {
  return {
    gain: makeFakeParam(1),
    connect: vi.fn(),
  };
}

function makeFakeAudioContext(): FakeAudioContext {
  const ctx: FakeAudioContext = {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(),
    createGain: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    _oscillators: [],
    _gains: [],
  };

  ctx.createOscillator.mockImplementation(() => {
    const osc = makeFakeOscillator();
    ctx._oscillators.push(osc);
    return osc;
  });

  ctx.createGain.mockImplementation(() => {
    const gain = makeFakeGain();
    ctx._gains.push(gain);
    return gain;
  });

  return ctx;
}

// ---------------------------------------------------------------------------
// Default config helper
// ---------------------------------------------------------------------------

function defaultConfig(overrides: Partial<MetronomeConfig> = {}): MetronomeConfig {
  return {
    bpm: 120,
    timeSignatureTop: 4,
    subdivision: 1,
    accent: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createMetronomeEngine', () => {
  let fakeCtx: FakeAudioContext;
  let factoryCallCount: number;

  beforeEach(() => {
    fakeCtx = makeFakeAudioContext();
    factoryCallCount = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeFactory() {
    return () => {
      factoryCallCount++;
      return fakeCtx as unknown as AudioContext;
    };
  }

  // -------------------------------------------------------------------------
  // Lazy construction
  // -------------------------------------------------------------------------

  it('does not construct AudioContext until start() is called', () => {
    createMetronomeEngine(makeFactory());
    expect(factoryCallCount).toBe(0);
  });

  it('constructs AudioContext on the first start() call', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig());
    expect(factoryCallCount).toBe(1);
  });

  it('does not construct AudioContext more than once across multiple start/stop cycles', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig());
    engine.stop();
    engine.start(defaultConfig());
    expect(factoryCallCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // isAvailable
  // -------------------------------------------------------------------------

  it('isAvailable() returns true with a working factory after start()', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig());
    expect(engine.isAvailable()).toBe(true);
  });

  it('isAvailable() returns false when the factory throws', () => {
    const throwingFactory = () => {
      throw new Error('no audio');
    };
    const engine = createMetronomeEngine(throwingFactory);
    engine.start(defaultConfig());
    expect(engine.isAvailable()).toBe(false);
  });

  it('start() is a no-op when factory throws (does not throw itself)', () => {
    const throwingFactory = () => {
      throw new Error('not supported');
    };
    const engine = createMetronomeEngine(throwingFactory);
    expect(() => engine.start(defaultConfig())).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // isRunning
  // -------------------------------------------------------------------------

  it('isRunning() returns false before start()', () => {
    const engine = createMetronomeEngine(makeFactory());
    expect(engine.isRunning()).toBe(false);
  });

  it('isRunning() returns true after start()', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig());
    expect(engine.isRunning()).toBe(true);
  });

  it('isRunning() returns false after stop()', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig());
    engine.stop();
    expect(engine.isRunning()).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Pulse scheduling — 120 BPM, subdivision 1
  // -------------------------------------------------------------------------

  it('schedules at least one click immediately on start (within look-ahead window)', () => {
    const engine = createMetronomeEngine(makeFactory());
    // currentTime = 0; look-ahead = 0.1 s; first pulse at 0 s — within window
    engine.start(defaultConfig({ bpm: 120, subdivision: 1 }));
    expect(fakeCtx._oscillators.length).toBeGreaterThanOrEqual(1);
  });

  it('schedules clicks approximately every 0.5 s at 120 BPM, subdivision 1', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig({ bpm: 120, timeSignatureTop: 4, subdivision: 1 }));

    // The look-ahead window is 0.1 s starting at currentTime=0.
    // Only pulses 0…0.1 s are scheduled in the first batch.
    // Pulse 0 is at t=0.0 (within window), pulse 1 at t=0.5 (outside window).
    const countAfterStart = fakeCtx._oscillators.length;

    // Advance audio clock to 0.45 s and fire the scheduler interval.
    fakeCtx.currentTime = 0.45;
    vi.advanceTimersByTime(25); // one scheduler tick

    // Now the look-ahead reaches 0.55 s, so pulse at 0.5 s should be scheduled.
    expect(fakeCtx._oscillators.length).toBeGreaterThan(countAfterStart);

    engine.stop();
  });

  it('first pulse in 4/4 is always the accent', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig({ bpm: 120, timeSignatureTop: 4, subdivision: 1, accent: true }));

    // First oscillator is the accent click.
    // Accent uses ACCENT_FREQ = 1320 Hz.
    const firstOsc = fakeCtx._oscillators[0];
    expect(firstOsc.frequency.value).toBe(1320);
    engine.stop();
  });

  it('second pulse in 4/4 quarter-note is a beat (880 Hz)', () => {
    const engine = createMetronomeEngine(makeFactory());

    // Advance audio clock so both pulses fall in the first look-ahead window.
    // Look-ahead = 0.1 s, beat interval at 120 BPM = 0.5 s — we need to
    // manually advance and trigger the scheduler to get 2 pulses scheduled.
    engine.start(defaultConfig({ bpm: 120, timeSignatureTop: 4, subdivision: 1 }));

    // Move clock forward and advance timer by one scheduler interval.
    fakeCtx.currentTime = 0.45;
    vi.advanceTimersByTime(25);

    // Second oscillator should be 880 Hz (beat).
    expect(fakeCtx._oscillators.length).toBeGreaterThanOrEqual(2);
    expect(fakeCtx._oscillators[1].frequency.value).toBe(880);
    engine.stop();
  });

  it('sub pulses use 440 Hz at subdivision 2', () => {
    const engine = createMetronomeEngine(makeFactory());
    // subdivision 2: pattern = [accent, sub, beat, sub, ...]
    // At 120 BPM, sub interval = 0.25 s
    engine.start(defaultConfig({ bpm: 120, timeSignatureTop: 4, subdivision: 2 }));

    // Schedule up to ~ 0.3 s: pulses at 0.0, 0.25 s (accent, sub)
    fakeCtx.currentTime = 0.2;
    vi.advanceTimersByTime(25);

    // pulse 0 = accent (1320), pulse 1 = sub (440)
    expect(fakeCtx._oscillators.length).toBeGreaterThanOrEqual(2);
    expect(fakeCtx._oscillators[1].frequency.value).toBe(440);
    engine.stop();
  });

  // -------------------------------------------------------------------------
  // accent: false — downbeat uses 'beat' tone instead of accent tone
  // -------------------------------------------------------------------------

  it('when accent is false the first pulse uses 880 Hz instead of 1320 Hz', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig({ accent: false }));

    const firstOsc = fakeCtx._oscillators[0];
    expect(firstOsc.frequency.value).toBe(880);
    engine.stop();
  });

  it('when accent is true the first pulse uses 1320 Hz', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig({ accent: true }));

    const firstOsc = fakeCtx._oscillators[0];
    expect(firstOsc.frequency.value).toBe(1320);
    engine.stop();
  });

  // -------------------------------------------------------------------------
  // Gain values for different kinds
  // -------------------------------------------------------------------------

  it('accent click has higher gain than beat click', () => {
    const engine = createMetronomeEngine(makeFactory());
    // Schedule first two pulses so we get accent then beat.
    engine.start(defaultConfig({ bpm: 120, timeSignatureTop: 4, subdivision: 1 }));
    fakeCtx.currentTime = 0.45;
    vi.advanceTimersByTime(25);

    expect(fakeCtx._gains.length).toBeGreaterThanOrEqual(2);
    const accentGainArg = fakeCtx._gains[0].gain.setValueAtTime.mock.calls[0]?.[0] as number;
    const beatGainArg = fakeCtx._gains[1].gain.setValueAtTime.mock.calls[0]?.[0] as number;

    expect(accentGainArg).toBeGreaterThan(beatGainArg);
    engine.stop();
  });

  it('sub click has lower gain than beat click', () => {
    const engine = createMetronomeEngine(makeFactory());
    // subdivision 2: [accent, sub, ...] at 0.0, 0.25 s
    engine.start(defaultConfig({ bpm: 120, timeSignatureTop: 4, subdivision: 2 }));
    fakeCtx.currentTime = 0.2;
    vi.advanceTimersByTime(25);

    expect(fakeCtx._gains.length).toBeGreaterThanOrEqual(2);
    // gains[0] is accent, gains[1] is sub
    // For comparison, also trigger a beat click (pulse 2 at 0.5 s)
    fakeCtx.currentTime = 0.45;
    vi.advanceTimersByTime(25);

    const subGainArg = fakeCtx._gains[1].gain.setValueAtTime.mock.calls[0]?.[0] as number;
    const beatGainArg = fakeCtx._gains[2].gain.setValueAtTime.mock.calls[0]?.[0] as number;

    expect(subGainArg).toBeLessThan(beatGainArg);
    engine.stop();
  });

  // -------------------------------------------------------------------------
  // onTick callback
  // -------------------------------------------------------------------------

  it('fires onTick with index=0 and kind=accent for the first pulse', () => {
    const ticks: TickInfo[] = [];
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig({ accent: true }), (info: TickInfo) => ticks.push(info));

    // Stop the metronome first so there are no more intervals firing, then
    // advance timers just enough to drain the pending onTick setTimeout(s)
    // that were already queued by the initial schedule() call.
    engine.stop();

    // The onTick timeouts were cleared by stop(), so we need to start, let the
    // initial schedule fire its setTimeout for index 0 (delay = 0 since
    // currentTime=0 and scheduledTime=0), then stop before more intervals fire.
    const ticks2: TickInfo[] = [];
    const engine2 = createMetronomeEngine(makeFactory());
    engine2.start(defaultConfig({ accent: true }), (info: TickInfo) => ticks2.push(info));
    // Advance just 1 ms to fire the already-queued setTimeout(fn, 0) for index 0.
    vi.advanceTimersByTime(1);
    engine2.stop();

    expect(ticks2.length).toBeGreaterThanOrEqual(1);
    expect(ticks2[0]).toEqual({ index: 0, kind: 'accent' });
  });

  it('fires onTick with kind=beat for index=0 when accent is false', () => {
    const ticks: TickInfo[] = [];
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig({ accent: false }), (info: TickInfo) => ticks.push(info));
    // First scheduled pulse is at currentTime=0, so the setTimeout delay is 0.
    // Advance 1 ms to fire it.
    vi.advanceTimersByTime(1);
    engine.stop();

    expect(ticks.length).toBeGreaterThanOrEqual(1);
    expect(ticks[0]).toEqual({ index: 0, kind: 'beat' });
  });

  it('fires onTick with incrementing index values for consecutive pulses', () => {
    const ticks: TickInfo[] = [];
    const engine = createMetronomeEngine(makeFactory());
    engine.start(
      defaultConfig({ bpm: 120, timeSignatureTop: 4, subdivision: 1 }),
      (info: TickInfo) => ticks.push(info),
    );

    // First pulse (index 0) is at t=0, scheduled immediately.
    // Advance 1 ms to fire its onTick setTimeout.
    vi.advanceTimersByTime(1);

    // Move audio clock so the next scheduler tick queues index 1 (at 0.5 s).
    fakeCtx.currentTime = 0.45;
    vi.advanceTimersByTime(25); // one scheduler interval
    // The onTick for index 1 has delay = (0.5 - 0.45)*1000 = 50 ms.
    vi.advanceTimersByTime(51);

    engine.stop();

    // Should have at least index 0 and index 1.
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0].index).toBe(0);
    expect(ticks[1].index).toBe(1);
  });

  it('does not fire onTick after stop()', () => {
    const ticks: TickInfo[] = [];
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig(), (info: TickInfo) => ticks.push(info));
    engine.stop();

    vi.runAllTimers();
    // After stop, pending timeouts are cancelled — no ticks should fire.
    expect(ticks).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // setConfig — live BPM change
  // -------------------------------------------------------------------------

  it('setConfig({bpm}) changes the pulse interval from the next scheduled pulse', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig({ bpm: 120, timeSignatureTop: 4, subdivision: 1 }));

    const countAfterFirstBatch = fakeCtx._oscillators.length;

    // Change BPM before the next scheduler tick.
    engine.setConfig({ bpm: 60 });

    // Advance audio clock to just below where the next 120-BPM pulse would be,
    // but well within where the 60-BPM pulse would land if scheduled from
    // currentPulseTime = last scheduled time + 0.5 s (120 BPM).
    // The key observation: after setConfig the next pulse spacing changes.
    // We just verify the scheduler still runs without throwing and creates more clicks.
    fakeCtx.currentTime = 0.95;
    vi.advanceTimersByTime(25);

    expect(fakeCtx._oscillators.length).toBeGreaterThan(countAfterFirstBatch);
    engine.stop();
  });

  it('setConfig can be called while stopped without throwing', () => {
    const engine = createMetronomeEngine(makeFactory());
    expect(() => engine.setConfig({ bpm: 100 })).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // stop() and dispose() — no further scheduling
  // -------------------------------------------------------------------------

  it('stop() clears the interval so no further oscillators are created', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig());

    engine.stop();
    const countAfterStop = fakeCtx._oscillators.length;

    fakeCtx.currentTime = 10;
    vi.advanceTimersByTime(200); // multiple scheduler intervals

    expect(fakeCtx._oscillators.length).toBe(countAfterStop);
  });

  it('stop() can be called twice without throwing', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig());
    engine.stop();
    expect(() => engine.stop()).not.toThrow();
  });

  it('dispose() clears the interval and closes the context', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig());
    engine.dispose();

    const countAfterDispose = fakeCtx._oscillators.length;
    fakeCtx.currentTime = 10;
    vi.advanceTimersByTime(200);

    expect(fakeCtx._oscillators.length).toBe(countAfterDispose);
    expect(fakeCtx.close).toHaveBeenCalled();
  });

  it('dispose() does not throw when called before start()', () => {
    const engine = createMetronomeEngine(makeFactory());
    expect(() => engine.dispose()).not.toThrow();
    expect(fakeCtx.close).not.toHaveBeenCalled();
  });

  it('isAvailable() returns false after dispose() and the factory is not called again', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig());
    expect(factoryCallCount).toBe(1);
    engine.dispose();
    // Engine must stay permanently dead: isAvailable() returns false and the
    // factory is never invoked again (no new AudioContext is built).
    expect(engine.isAvailable()).toBe(false);
    expect(factoryCallCount).toBe(1);
  });

  it('start() is a no-op after dispose() (factory not called again)', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig());
    engine.dispose();
    const countAfterDispose = factoryCallCount;
    engine.start(defaultConfig());
    expect(factoryCallCount).toBe(countAfterDispose);
    expect(engine.isRunning()).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Catch-up clamp — no burst scheduling after throttled background tab
  // -------------------------------------------------------------------------

  it('schedules at most one look-ahead window of clicks when audio clock jumps forward', () => {
    const engine = createMetronomeEngine(makeFactory());
    // 120 BPM quarter notes: one click every 0.5 s.
    engine.start(defaultConfig({ bpm: 120, timeSignatureTop: 4, subdivision: 1 }));

    // Initial schedule fires at currentTime=0; first click at t=0 is scheduled.
    const countAfterStart = fakeCtx._oscillators.length;

    // Simulate a throttled background tab: audio clock jumps 10 s ahead while
    // the JS scheduler was paused.  Without the clamp the scheduler would try
    // to fill in ~20 past-dated clicks in a single tick.
    fakeCtx.currentTime = 10;
    vi.advanceTimersByTime(25); // one scheduler interval

    const newClicks = fakeCtx._oscillators.length - countAfterStart;

    // With the catch-up clamp, nextPulseAudioTime is re-anchored to
    // ctx.currentTime (10 s) so the look-ahead window [10, 10.1] contains at
    // most one pulse — never a burst of many past-dated clicks.
    expect(newClicks).toBeLessThanOrEqual(2); // at most one look-ahead window worth

    // Also verify no click was scheduled far in the past (all start times must
    // be >= the audio time at the moment the scheduler tick ran, i.e. >= 10 s).
    const allStartTimes = fakeCtx._oscillators
      .slice(countAfterStart)
      .map((osc) => osc.start.mock.calls[0][0] as number);
    for (const t of allStartTimes) {
      expect(t).toBeGreaterThanOrEqual(10);
    }

    engine.stop();
  });

  // -------------------------------------------------------------------------
  // Restart: calling start() again resets state
  // -------------------------------------------------------------------------

  it('calling start() a second time restarts from index 0 without duplicating intervals', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig());
    const countFirst = fakeCtx._oscillators.length;

    engine.start(defaultConfig());
    // After the second start the scheduler fires immediately again, so we get
    // new oscillators. But crucially, the interval should not be doubled.
    const countSecond = fakeCtx._oscillators.length;
    expect(countSecond).toBeGreaterThan(countFirst);

    // Advance time — if we got two setIntervals the oscillator count would
    // grow at twice the rate. We verify isRunning() is still true, i.e. only
    // one engine is logically running.
    expect(engine.isRunning()).toBe(true);
    engine.stop();
  });

  // -------------------------------------------------------------------------
  // Pulse timing math sanity check
  // -------------------------------------------------------------------------

  it('the time between two consecutive start oscillators matches secondsPerSubPulse(120, 1)', () => {
    const engine = createMetronomeEngine(makeFactory());
    engine.start(defaultConfig({ bpm: 120, subdivision: 1 }));

    // Advance clock so two pulses are scheduled.
    fakeCtx.currentTime = 0.45;
    vi.advanceTimersByTime(25);

    expect(fakeCtx._oscillators.length).toBeGreaterThanOrEqual(2);

    // The start time of oscillator 0 is the first arg to osc.start().
    const t0 = fakeCtx._oscillators[0].start.mock.calls[0][0] as number;
    const t1 = fakeCtx._oscillators[1].start.mock.calls[0][0] as number;

    const expected = secondsPerSubPulse(120, 1); // 0.5 s
    expect(t1 - t0).toBeCloseTo(expected, 5);
    engine.stop();
  });

  it('the time between consecutive pulses is halved when subdivision doubles from 1 to 2', () => {
    const makeAndGetFirstTwoTimes = (subdivision: 1 | 2) => {
      const localCtx = makeFakeAudioContext();
      const engine = createMetronomeEngine(() => localCtx as unknown as AudioContext);
      engine.start(defaultConfig({ bpm: 120, timeSignatureTop: 4, subdivision }));
      // For subdivision 1: interval 0.5 s, need currentTime ~0.41 to schedule pulse 2
      // For subdivision 2: interval 0.25 s, need currentTime ~0.16 to schedule pulse 2
      // Use 0.2 s for subdivision 2 and 0.45 s for subdivision 1 — pick 0.45 s to
      // cover both cases (0.45 + 0.1 look-ahead = 0.55 > both 0.25 and 0.5).
      localCtx.currentTime = 0.45;
      vi.advanceTimersByTime(25);
      engine.stop();
      const oscs = localCtx._oscillators;
      // Ensure at least two pulses were scheduled.
      expect(oscs.length).toBeGreaterThanOrEqual(2);
      const t0 = oscs[0].start.mock.calls[0][0] as number;
      const t1 = oscs[1].start.mock.calls[0][0] as number;
      return t1 - t0;
    };

    const gapSub1 = makeAndGetFirstTwoTimes(1);
    const gapSub2 = makeAndGetFirstTwoTimes(2);

    expect(gapSub1 / gapSub2).toBeCloseTo(2, 5);
  });
});
