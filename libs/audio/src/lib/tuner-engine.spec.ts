import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTunerEngine } from './tuner-engine.js';

// ---------------------------------------------------------------------------
// Fake AudioContext helpers
// ---------------------------------------------------------------------------

type FakeAudioParam = {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
};

function makeFakeParam(initial = 0): FakeAudioParam {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
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
  disconnect: ReturnType<typeof vi.fn>;
};

type FakeGain = {
  gain: FakeAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

type FakeAudioContext = {
  currentTime: number;
  destination: object;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  /** All oscillators created so far, in order. */
  _oscillators: FakeOscillator[];
};

function makeFakeOscillator(): FakeOscillator {
  return {
    type: 'sine',
    frequency: makeFakeParam(440),
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    disconnect: vi.fn(),
  };
}

function makeFakeGain(): FakeGain {
  return {
    gain: makeFakeParam(1),
    connect: vi.fn(),
    disconnect: vi.fn(),
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
  };

  ctx.createOscillator.mockImplementation(() => {
    const osc = makeFakeOscillator();
    ctx._oscillators.push(osc);
    return osc;
  });

  ctx.createGain.mockImplementation(() => makeFakeGain());

  return ctx;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createTunerEngine', () => {
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

  it('does not construct the AudioContext until playFrequency is first called', () => {
    createTunerEngine(makeFactory());
    expect(factoryCallCount).toBe(0);
  });

  it('constructs the AudioContext on the first playFrequency call', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    expect(factoryCallCount).toBe(1);
  });

  it('constructs the AudioContext at most once across multiple playFrequency calls', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    engine.playFrequency(880);
    expect(factoryCallCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // isAvailable
  // -------------------------------------------------------------------------

  it('isAvailable() returns true after a successful playFrequency call', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    expect(engine.isAvailable()).toBe(true);
  });

  it('isAvailable() returns false when the factory throws', () => {
    const throwingFactory = () => {
      throw new Error('AudioContext not supported');
    };
    const engine = createTunerEngine(throwingFactory);
    // Trigger context construction attempt
    engine.playFrequency(440);
    expect(engine.isAvailable()).toBe(false);
  });

  it('isAvailable() returns false before any call when factory throws', () => {
    const throwingFactory = () => {
      throw new Error('no audio');
    };
    const engine = createTunerEngine(throwingFactory);
    // isAvailable itself tries to construct the context
    expect(engine.isAvailable()).toBe(false);
  });

  it('isAvailable() does not throw when called before playFrequency with a good factory', () => {
    const engine = createTunerEngine(makeFactory());
    // Should attempt construction; no throw
    expect(() => engine.isAvailable()).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Oscillator properties
  // -------------------------------------------------------------------------

  it('creates a sine oscillator', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    expect(fakeCtx._oscillators).toHaveLength(1);
    expect(fakeCtx._oscillators[0].type).toBe('sine');
  });

  it('sets the oscillator frequency to the provided value', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(880);
    expect(fakeCtx._oscillators[0].frequency.value).toBe(880);
  });

  it('connects the oscillator to a gain node and the gain to the destination', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    const osc = fakeCtx._oscillators[0];
    // osc → gain
    expect(osc.connect).toHaveBeenCalled();
    // gain → destination: the gain's connect was called with the destination
    const gainNode = fakeCtx.createGain.mock.results[0].value as FakeGain;
    expect(gainNode.connect).toHaveBeenCalledWith(fakeCtx.destination);
  });

  it('calls osc.start on the oscillator', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    expect(fakeCtx._oscillators[0].start).toHaveBeenCalled();
  });

  it('schedules osc.stop via AudioContext timing', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    // stop() is called with a future time (>= currentTime + durationSeconds)
    expect(fakeCtx._oscillators[0].stop).toHaveBeenCalledWith(expect.any(Number));
  });

  // -------------------------------------------------------------------------
  // Envelope — gain ramps
  // -------------------------------------------------------------------------

  it('applies attack ramp to the gain node', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    const gainNode = fakeCtx.createGain.mock.results[0].value as FakeGain;
    // setValueAtTime to 0 at start (beginning of attack)
    expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
    // linear ramp up to PEAK_GAIN (0.6)
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.6, expect.any(Number));
  });

  it('applies exponential release ramp to near-zero', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440, 2);
    const gainNode = fakeCtx.createGain.mock.results[0].value as FakeGain;
    // exponential ramp to RELEASE_GAIN (0.001) at currentTime + duration
    expect(gainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      0.001,
      expect.any(Number),
    );
  });

  // -------------------------------------------------------------------------
  // Monophonic: second call stops first oscillator
  // -------------------------------------------------------------------------

  it('stops the first oscillator when a second playFrequency is called', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    const firstOsc = fakeCtx._oscillators[0];

    engine.playFrequency(880);

    // The first oscillator's stop should be scheduled via setTimeout + stop()
    // Advance timers so the fade-out setTimeout fires.
    vi.runAllTimers();
    expect(firstOsc.stop).toHaveBeenCalled();
  });

  it('creates a second oscillator for the second playFrequency call', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    engine.playFrequency(880);
    expect(fakeCtx._oscillators).toHaveLength(2);
    expect(fakeCtx._oscillators[1].frequency.value).toBe(880);
  });

  // -------------------------------------------------------------------------
  // stop()
  // -------------------------------------------------------------------------

  it('stop() fades out and stops the current oscillator', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    const osc = fakeCtx._oscillators[0];
    engine.stop();
    vi.runAllTimers();
    expect(osc.stop).toHaveBeenCalled();
  });

  it('stop() does not throw when nothing is playing', () => {
    const engine = createTunerEngine(makeFactory());
    expect(() => engine.stop()).not.toThrow();
  });

  it('stop() does not throw when no AudioContext has been created yet', () => {
    const engine = createTunerEngine(makeFactory());
    expect(() => engine.stop()).not.toThrow();
    expect(factoryCallCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // playFrequency no-ops gracefully when factory throws
  // -------------------------------------------------------------------------

  it('playFrequency is a no-op (does not throw) when factory throws', () => {
    const throwingFactory = () => {
      throw new Error('not supported');
    };
    const engine = createTunerEngine(throwingFactory);
    expect(() => engine.playFrequency(440)).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // dispose()
  // -------------------------------------------------------------------------

  it('dispose() calls close() on the AudioContext', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    engine.dispose();
    vi.runAllTimers();
    expect(fakeCtx.close).toHaveBeenCalled();
  });

  it('dispose() does not throw when called before any playFrequency', () => {
    const engine = createTunerEngine(makeFactory());
    expect(() => engine.dispose()).not.toThrow();
    // Context was never built, so close should not have been called.
    expect(fakeCtx.close).not.toHaveBeenCalled();
  });

  it('isAvailable() returns false after dispose() and the factory is not called again', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    expect(factoryCallCount).toBe(1);
    engine.dispose();
    // Engine must stay permanently dead: isAvailable() returns false and the
    // factory is never called again (no new AudioContext is built).
    expect(engine.isAvailable()).toBe(false);
    expect(factoryCallCount).toBe(1);
  });

  it('playFrequency is a no-op after dispose() (factory not called again)', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    engine.dispose();
    const countAfterDispose = factoryCallCount;
    engine.playFrequency(880);
    expect(factoryCallCount).toBe(countAfterDispose);
  });

  // -------------------------------------------------------------------------
  // Default duration
  // -------------------------------------------------------------------------

  it('uses a default duration of 3 seconds when none is supplied', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440);
    const gainNode = fakeCtx.createGain.mock.results[0].value as FakeGain;
    // The exponential ramp target time should be currentTime + 3
    const call = gainNode.gain.exponentialRampToValueAtTime.mock.calls[0];
    expect(call[1]).toBeCloseTo(fakeCtx.currentTime + 3, 3);
  });

  it('respects a custom duration parameter', () => {
    const engine = createTunerEngine(makeFactory());
    engine.playFrequency(440, 5);
    const gainNode = fakeCtx.createGain.mock.results[0].value as FakeGain;
    const call = gainNode.gain.exponentialRampToValueAtTime.mock.calls[0];
    expect(call[1]).toBeCloseTo(fakeCtx.currentTime + 5, 3);
  });
});
