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

  public async init(instruments: string[] = []) {
    if (this.isInitialized) return;
    
    try {
      await this.context.audioWorklet.addModule(processorUrl);
      
      const numOutputs = Math.max(2, instruments.length);
      const outputChannelCount = Array(numOutputs).fill(2);
      
      this.workletNode = new AudioWorkletNode(this.context, 'tenuto-processor', {
        numberOfInputs: 1,
        numberOfOutputs: numOutputs,
        outputChannelCount
      });

      // Send instrument mapping to worklet
      this.workletNode.port.postMessage({
        type: 'SET_INSTRUMENTS',
        instruments
      });

      this.convolver = this.context.createConvolver();
      this.dryGain = this.context.createGain();
      this.wetGain = this.context.createGain();

      // Load a simple impulse response for reverb
      this.generateSyntheticIR();

      // We will route outputs dynamically in loadInstruments
      
      // Listen for messages from worklet
      this.workletNode.port.onmessage = (e) => {
        if (e.data.type === 'AUTOMATION') {
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

  public async loadInstruments(events: AudioEvent[], defs?: any[]) {
    const instruments = Array.from(new Set(events.map(e => e.instrument)));
    await this.init(instruments);
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < instruments.length; i++) {
      const instrument = instruments[i];
      if (!this.trackBuses[instrument]) {
        const bus = this.context.createGain();
        this.trackBuses[instrument] = bus;
        
        // Connect the worklet output for this instrument to its bus
        if (this.workletNode) {
          this.workletNode.connect(bus, i);
        }
        
        // Check if this track has FX defined in the AST defs or events
        const fxEvent = events.find(e => e.instrument === instrument && e.fx);
        
        if (fxEvent && fxEvent.fx) {
          const fx = fxEvent.fx;
          let fxNode: AudioNode | null = null;
          
          if (fx.type === 'hall' || fx.type === 'reverb') {
            const convolver = this.context.createConvolver();
            this.generateSyntheticIRForNode(convolver);
            fxNode = convolver;
          } else if (fx.type === 'delay') {
            const delay = this.context.createDelay();
            delay.delayTime.value = fx.time ? parseFloat(fx.time) / 1000 : 0.25;
            
            const feedback = this.context.createGain();
            feedback.gain.value = fx.feedback ? parseFloat(fx.feedback) : 0.3;
            
            delay.connect(feedback);
            feedback.connect(delay);
            
            fxNode = delay;
          }
          
          if (fxNode) {
            const dryGain = this.context.createGain();
            const wetGain = this.context.createGain();
            
            const dryWet = fx.dryWet !== undefined ? fx.dryWet : 0.5;
            dryGain.gain.value = 1 - dryWet;
            wetGain.gain.value = dryWet;
            
            bus.connect(dryGain);
            bus.connect(fxNode);
            fxNode.connect(wetGain);
            
            dryGain.connect(this.context.destination);
            wetGain.connect(this.context.destination);
          } else {
            bus.connect(this.context.destination);
          }
        } else {
          bus.connect(this.context.destination);
        }
      }
    }

    for (const event of events) {
      if (event.style === 'standard') {
        const instrumentName = PATCH_MAP[event.instrument] || 'acoustic_grand_piano';
        if (!this.soundfonts[instrumentName]) {
          this.soundfonts[instrumentName] = new Soundfont(this.context, { instrument: instrumentName });
          promises.push(this.soundfonts[instrumentName].loaded());
          // Route soundfont output to its bus
          (this.soundfonts[instrumentName].output as any).connect(this.trackBuses[event.instrument]);
        }
      } else if (event.style === 'concrete' && event.src) {
        if (!event.src.startsWith('bus://') && !this.audioBuffers[event.src]) {
          promises.push(this.loadAudioBuffer(event.src));
        }
      }
    }
    
    try {
      await Promise.all(promises);
    } catch (e) {
      console.warn("Some instruments failed to load, falling back to basic oscillators.", e);
    }
  }

  private generateSyntheticIRForNode(convolver: ConvolverNode) {
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
    convolver.buffer = impulse;
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

  public async play(events: AudioEvent[], startTime: number) {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    
    if (!this.workletNode) {
      console.warn("AudioWorkletNode not initialized. Audio playback may fail.");
      return;
    }
    
    // Adjust event times relative to startTime
    const adjustedEvents = events.map(e => {
      let time = e.time;
      if (e.push) time -= e.push / 1000000;
      if (e.pull) time += e.pull / 1000000;
      return { ...e, time: startTime + time };
    });

    console.log("TEDP: Dispatching events to hardware", adjustedEvents);

    // Schedule soundfonts directly in the main thread for precise timing
    for (const event of adjustedEvents) {
      if (event.style === 'standard') {
        this.scheduleSoundfont(event);
      }
    }

    this.workletNode.port.postMessage({
      type: 'PLAY',
      events: adjustedEvents.filter(e => e.style !== 'standard')
    });
  }

  private scheduleSoundfont(event: AudioEvent) {
    if (event.note === undefined) return;
    const instrumentName = PATCH_MAP[event.instrument] || 'acoustic_grand_piano';
    const sf = this.soundfonts[instrumentName];
    try {
      if (sf) {
        sf.start({
          note: event.note,
          velocity: event.velocity || 80,
          time: event.time,
          duration: event.duration
        });
      } else {
        this.playFallbackOscillator(event);
      }
    } catch (e) {
      console.warn(`Soundfont failed to play for ${instrumentName}, falling back to oscillator`, e);
      this.playFallbackOscillator(event);
    }
  }

  private playFallbackOscillator(event: AudioEvent) {
    if (event.note === undefined) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'sine';
    // Convert MIDI note to frequency
    osc.frequency.value = 440 * Math.pow(2, (event.note - 69) / 12);
    
    const velocity = event.velocity || 80;
    const safeTime = Math.max(event.time, this.context.currentTime);
    
    const attackTime = Math.min(0.01, event.duration / 3);
    const releaseTime = Math.min(0.05, event.duration / 3);
    
    gain.gain.setValueAtTime(0, safeTime);
    gain.gain.linearRampToValueAtTime((velocity / 127) * 0.3, safeTime + attackTime);
    gain.gain.setValueAtTime((velocity / 127) * 0.3, safeTime + event.duration - releaseTime);
    gain.gain.linearRampToValueAtTime(0, safeTime + event.duration);
    
    const bus = this.trackBuses[event.instrument];
    if (bus) {
      osc.connect(gain);
      gain.connect(bus);
    } else {
      osc.connect(gain);
      gain.connect(this.context.destination);
    }
    
    osc.start(safeTime);
    osc.stop(safeTime + event.duration);
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
