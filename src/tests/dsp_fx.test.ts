import { describe, it, expect, vi } from 'vitest';
import * as Tone from 'tone';
import { AudioEngine } from '../audio/engine';
import { AudioEvent } from '../compiler/audio';

// Mock window
(global as any).window = {
  AudioContext: vi.fn().mockImplementation(function() {
    return {
      audioWorklet: {
        addModule: vi.fn().mockResolvedValue(undefined)
      },
      createConvolver: vi.fn().mockReturnValue({
        buffer: null,
        connect: vi.fn()
      }),
      createGain: vi.fn().mockReturnValue({
        gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn()
      }),
      createDelay: vi.fn().mockReturnValue({
        delayTime: { value: 0 },
        connect: vi.fn()
      }),
      createBuffer: vi.fn().mockReturnValue({
        getChannelData: vi.fn().mockReturnValue(new Float32Array(88200))
      }),
      sampleRate: 44100,
      destination: {}
    };
  })
};

(global as any).AudioNode = class AudioNode {
  connect() {}
  disconnect() {}
};

// Mock Tone.js and AudioContext
vi.mock('tone', () => ({
  __esModule: true,
  start: vi.fn().mockResolvedValue(undefined),
  setContext: vi.fn(),
  Destination: {},
  Gain: vi.fn().mockImplementation(function() {
    return {
      connect: vi.fn(),
      toDestination: vi.fn()
    };
  }),
  Reverb: vi.fn().mockImplementation(function() {
    return {
      generate: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn(),
      toDestination: vi.fn()
    };
  }),
  FeedbackDelay: vi.fn().mockImplementation(function() {
    return {
      connect: vi.fn(),
      toDestination: vi.fn()
    };
  }),
  getContext: () => ({
    rawContext: {
      audioWorklet: {
        addModule: vi.fn().mockResolvedValue(undefined)
      },
      createConvolver: vi.fn().mockReturnValue({
        buffer: null,
        connect: vi.fn()
      }),
      createGain: vi.fn().mockReturnValue({
        gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn()
      }),
      createDelay: vi.fn().mockReturnValue({
        delayTime: { value: 0 },
        connect: vi.fn()
      }),
      createBuffer: vi.fn().mockReturnValue({
        getChannelData: vi.fn().mockReturnValue(new Float32Array(88200))
      }),
      sampleRate: 44100,
      destination: {}
    }
  })
}));

// Mock smplr
vi.mock('smplr', () => ({
  Soundfont: vi.fn().mockImplementation(function() {
    return {
      output: { connect: vi.fn() },
      start: vi.fn(),
      stop: vi.fn(),
      loaded: vi.fn().mockResolvedValue(undefined)
    };
  })
}));

// Mock AudioWorkletNode
global.AudioWorkletNode = vi.fn().mockImplementation(function() {
  return {
    connect: vi.fn(),
    port: {
      postMessage: vi.fn(),
      onmessage: null
    }
  };
}) as any;

describe('DSP: Isolated FX Chains & Routing Graphs', () => {
  it('Task 3A & 3C: Dynamic Routing Nodes & Mixer Graph - creates isolated FX chains per track', async () => {
    const engine = new AudioEngine();
    
    const events: AudioEvent[] = [
      {
        time: 0,
        duration: 1,
        instrument: 'gm_piano',
        style: 'standard',
        fx: { type: 'hall', dryWet: 0.8 }
      },
      {
        time: 0,
        duration: 1,
        instrument: 'gm_synth',
        style: 'standard',
        fx: { type: 'delay', time: '250', feedback: '0.6', dryWet: 0.5 }
      }
    ];
    
    await engine.loadInstruments(events);
    
    // Check if track buses were created
    const anyEngine = engine as any;
    expect(anyEngine.trackBuses['gm_piano']).toBeDefined();
    expect(anyEngine.trackBuses['gm_synth']).toBeDefined();
    
    // Check if Tone.js FX nodes were created
    expect(Tone.Reverb).toHaveBeenCalled();
    expect(Tone.FeedbackDelay).toHaveBeenCalled();
  });
});
