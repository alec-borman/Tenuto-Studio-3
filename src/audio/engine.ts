import * as Tone from 'tone';
import { Soundfont } from 'smplr';
import { AudioEvent } from '../compiler/audio';
// @ts-ignore
import processorUrl from './processor.ts?worker&url';

const PATCH_MAP: Record<string, string> = {
  'gm_piano': 'acoustic_grand_piano',
  'gm_epiano': 'electric_piano_1',
  'gm_bass': 'acoustic_bass',
  'gm_strings': 'string_ensemble_1',
  'gm_drums': 'synth_drum',
  'gm_synth': 'lead_1_square',
  'gm_vox': 'choir_aahs'
};

export class AudioEngine {
  private context: AudioContext;
  private soundfonts: Record<string, Soundfont> = {};
  private activeNodes: Set<any> = new Set();
  private audioBuffers: Record<string, AudioBuffer> = {};
  private workletNode: AudioWorkletNode | null = null;
  private convolver: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private trackBuses: Record<string, GainNode> = {};
  private isInitialized: boolean = false;

  constructor() {
    this.context = Tone.getContext().rawContext as AudioContext;
  }

  public async init() {
    if (this.isInitialized) return;
    
    try {
      await this.context.audioWorklet.addModule(processorUrl);
      
      // We request 2 outputs: [0] is dry, [1] is wet
      this.workletNode = new AudioWorkletNode(this.context, 'tenuto-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 2,
        outputChannelCount: [2, 2]
      });

      this.convolver = this.context.createConvolver();
      this.dryGain = this.context.createGain();
      this.wetGain = this.context.createGain();

      // Load a simple impulse response for reverb
      this.generateSyntheticIR();

      // Route dry signal
      this.workletNode.connect(this.dryGain, 0);
      this.dryGain.connect(this.context.destination);

      // Route wet signal through convolver
      this.workletNode.connect(this.convolver, 1);
      this.convolver.connect(this.wetGain);
      this.wetGain.connect(this.context.destination);

      // Listen for messages from worklet (e.g., to play soundfonts)
      this.workletNode.port.onmessage = (e) => {
        if (e.data.type === 'PLAY_SOUNDFONT') {
          this.scheduleSoundfont(e.data.event);
        } else if (e.data.type === 'AUTOMATION') {
          this.handleAutomation(e.data.event);
        }
      };

      this.isInitialized = true;
    } catch (e) {
      console.error("Failed to initialize AudioWorklet", e);
    }
  }

  private generateSyntheticIR() {
    if (!this.convolver) return;
    const sampleRate = this.context.sampleRate;
    const length = sampleRate * 2.0; // 2 seconds
    const impulse = this.context.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (sampleRate * 0.5));
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    this.convolver.buffer = impulse;
  }

  public async loadInstruments(events: AudioEvent[]) {
    await this.init();
    const promises: Promise<void>[] = [];
    
    for (const event of events) {
      if (!this.trackBuses[event.instrument]) {
        const bus = this.context.createGain();
        this.trackBuses[event.instrument] = bus;
        // Connect bus to worklet input so it can be sampled
        if (this.workletNode) {
          bus.connect(this.workletNode);
        }
      }

      if (event.style === 'standard') {
        const instrumentName = PATCH_MAP[event.instrument] || 'acoustic_grand_piano';
        if (!this.soundfonts[instrumentName]) {
          this.soundfonts[instrumentName] = new Soundfont(this.context, { instrument: instrumentName });
          // Route soundfont output to its bus
          // smplr Soundfont has an output node
          this.soundfonts[instrumentName].output.connect(this.trackBuses[event.instrument]);
        }
      } else if (event.style === 'concrete' && event.src) {
        if (!event.src.startsWith('bus://') && !this.audioBuffers[event.src]) {
          promises.push(this.loadAudioBuffer(event.src));
        }
      }
    }
    
    await Promise.all(promises);
  }

  private async loadAudioBuffer(url: string) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.audioBuffers[url] = audioBuffer;
      
      // Send buffer to worklet
      if (this.workletNode) {
        const channels = [];
        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
          channels.push(audioBuffer.getChannelData(i));
        }
        this.workletNode.port.postMessage({
          type: 'LOAD_BUFFER',
          url,
          buffer: channels
        });
      }
    } catch (e) {
      console.error(`Failed to load concrete audio from ${url}`, e);
    }
  }

  public play(events: AudioEvent[], startTime: number) {
    if (!this.workletNode) return;
    
    // Adjust event times relative to startTime
    const adjustedEvents = events.map(e => {
      let time = e.time;
      if (e.push) time -= e.push / 1000000;
      if (e.pull) time += e.pull / 1000000;
      return { ...e, time: startTime + time };
    });

    this.workletNode.port.postMessage({
      type: 'PLAY',
      events: adjustedEvents
    });
  }

  private scheduleSoundfont(event: AudioEvent) {
    const instrumentName = PATCH_MAP[event.instrument] || 'acoustic_grand_piano';
    const sf = this.soundfonts[instrumentName];
    if (sf) {
      sf.start({
        note: event.note,
        velocity: event.velocity,
        time: event.time,
        duration: event.duration
      });
    }
  }

  private handleAutomation(event: AudioEvent) {
    if (event.controller === 'volume' && this.dryGain && this.wetGain) {
      const startVal = event.startValue ?? 1.0;
      const endVal = event.endValue ?? 1.0;
      
      this.dryGain.gain.setValueAtTime(startVal, event.time);
      if (event.curve === 'linear') {
        this.dryGain.gain.linearRampToValueAtTime(endVal, event.time + event.duration);
      } else {
        this.dryGain.gain.exponentialRampToValueAtTime(Math.max(0.001, endVal), event.time + event.duration);
      }
      
      this.wetGain.gain.setValueAtTime(startVal, event.time);
      if (event.curve === 'linear') {
        this.wetGain.gain.linearRampToValueAtTime(endVal, event.time + event.duration);
      } else {
        this.wetGain.gain.exponentialRampToValueAtTime(Math.max(0.001, endVal), event.time + event.duration);
      }
    } else if (event.controller === 'pan') {
      // In a more complex setup, we'd have a StereoPannerNode per instrument/track.
      // For now, we'll create a temporary panner and apply it to the master output.
      // A proper implementation would route the specific instrument through this panner.
      const panner = this.context.createStereoPanner();
      
      const startVal = event.startValue ?? 0;
      const endVal = event.endValue ?? 0;

      panner.pan.setValueAtTime(startVal, event.time);
      if (event.curve === 'linear') {
        panner.pan.linearRampToValueAtTime(endVal, event.time + event.duration);
      } else {
        // pan values can be negative, so exponential ramp might not work directly if crossing 0
        // We'll just use linear for pan for simplicity unless we map it to 0-1
        panner.pan.linearRampToValueAtTime(endVal, event.time + event.duration);
      }

      // Connect the panner to the destination (this is a simplified routing)
      // In a real scenario, this would be inserted into the specific instrument's chain
      if (this.dryGain) {
        this.dryGain.disconnect();
        this.dryGain.connect(panner);
        panner.connect(this.context.destination);
      }
    }
  }

  // Keep this for backwards compatibility if needed by other components
  public schedule(event: AudioEvent, startTime: number) {
    // No-op since we use play() now
  }

  public stopAll() {
    for (const key in this.soundfonts) {
      this.soundfonts[key].stop();
    }
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'STOP' });
    }
  }
}
