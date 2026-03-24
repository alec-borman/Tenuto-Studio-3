import * as Tone from 'tone';
import { Soundfont } from 'smplr';
import { AudioEvent } from '../compiler/audio';

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
  private context!: AudioContext;
  private soundfonts: Record<string, Soundfont> = {};
  private activeNodes: Set<any> = new Set();
  private audioBuffers: Record<string, AudioBuffer> = {};
  private workletNode: AudioWorkletNode | null = null;
  private convolver: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private trackBuses: Record<string, GainNode> = {};
  private isInitialized: boolean = false;

  private sharedBuffer: SharedArrayBuffer | null = null;
  private int32View: Int32Array | null = null;
  private floatView: Float32Array | null = null;
  private instrumentIdMap: Record<string, number> = {};
  private nextInstrumentId = 1;
  private bufferIdMap: Record<string, number> = {};
  private nextBufferId = 1;

  private getInstrumentId(name: string): number {
    if (!this.instrumentIdMap[name]) {
      this.instrumentIdMap[name] = this.nextInstrumentId++;
    }
    return this.instrumentIdMap[name];
  }

  private getBufferId(src: string | undefined): number {
    if (!src) return 0;
    if (src.startsWith('bus://')) return -1;
    if (!this.bufferIdMap[src]) {
      this.bufferIdMap[src] = this.nextBufferId++;
    }
    return this.bufferIdMap[src];
  }

  constructor() {
    // Context initialization moved to init() to prevent TypeError on boot
  }

  /**
   * Initializes the AudioEngine, setting up the AudioContext, AudioWorklet, and routing.
   * 
   * @param instruments - An optional array of instrument names to initialize output channels for.
   * @returns A Promise that resolves when initialization is complete.
   */
  public async init(instruments: string[] = []) {
    if (this.isInitialized) return;
    
    // 1. Force Native AudioContext to bypass iframe constructor mismatch
    if (!this.context) {
      const NativeAudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.context = new NativeAudioContext();
      Tone.setContext(this.context);
      await Tone.start();
    }
    
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    // 2. Dual-Environment Check (Cloud Preview vs Local Native)
    const isCrossOriginIsolated = typeof SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated;

    try {
      const workletUrl = new URL('./processor.ts', import.meta.url).href;
      await this.context.audioWorklet.addModule(workletUrl, { type: 'module' } as any);
      
      const numOutputs = Math.max(2, instruments.length);
      this.workletNode = new AudioWorkletNode(this.context, 'tenuto-processor', {
        numberOfInputs: 1,
        numberOfOutputs: numOutputs,
        outputChannelCount: Array(numOutputs).fill(2)
      });

      // Only allocate high-performance buffer if the environment allows it
      if (isCrossOriginIsolated) {
        const MAX_EVENTS = 1024;
        const FLOATS_PER_EVENT = 24;
        this.sharedBuffer = new SharedArrayBuffer(8 + MAX_EVENTS * FLOATS_PER_EVENT * 4);
        this.int32View = new Int32Array(this.sharedBuffer, 0, 2);
        this.floatView = new Float32Array(this.sharedBuffer, 8);
        console.log("[TEDP] High-Performance RingBuffer Initialized.");
      } else {
        console.warn("[TEDP] SharedArrayBuffer blocked. Falling back to postMessage transport.");
      }

      // Send INIT message (sharedBuffer will be null if blocked)
      this.workletNode.port.postMessage({
        type: 'INIT',
        sharedBuffer: this.sharedBuffer,
        instruments
      });

      this.convolver = this.context.createConvolver();
      this.dryGain = this.context.createGain();
      this.wetGain = this.context.createGain();

      this.generateSyntheticIR();
      
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

  /**
   * Loads the required soundfonts and audio buffers for the given audio events.
   * 
   * @param events - An array of AudioEvents containing the instruments and sources to load.
   * @param defs - Optional array of instrument definitions for advanced routing.
   * @returns A Promise that resolves when all assets are loaded.
   */
  public async loadInstruments(events: AudioEvent[], defs?: any[]) {
    const instruments = Array.from(new Set(events.map(e => e.instrument)));
    await this.init(instruments);
    const promises: Promise<any>[] = [];
    
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
          bufferId: this.getBufferId(url),
          buffer: channels
        });
      }
    } catch (e) {
      console.error(`Failed to load concrete audio from ${url}`, e);
    }
  }

  /**
   * Schedules and plays a sequence of audio events.
   * 
   * @param events - An array of AudioEvents to be played.
   * @param startTime - The base AudioContext time (in seconds) to schedule the events against.
   * @returns A Promise that resolves when the playback has been successfully scheduled.
   */
  public async play(events: AudioEvent[], startTime: number) {
    await Tone.start();
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

    // Now serialize non-standard events to SharedArrayBuffer
    const workletEvents = adjustedEvents.filter(e => e.style !== 'standard');
    
    if (workletEvents.length > 0) {
      const useRingBuffer = !!(this.sharedBuffer && this.int32View && this.floatView);
      const MAX_EVENTS = 1024;
      const FLOATS_PER_EVENT = 24;
      
      let writeIdx = 0;
      let readIdx = 0;
      if (useRingBuffer && this.int32View) {
        writeIdx = Atomics.load(this.int32View, 0);
        readIdx = Atomics.load(this.int32View, 1);
      }
      
      for (const event of workletEvents) {
        if (useRingBuffer && this.int32View && this.floatView) {
          if (writeIdx - readIdx >= MAX_EVENTS) {
            console.warn("AudioWorklet ring buffer full, dropping events");
            break;
          }
          
          const offset = (writeIdx % MAX_EVENTS) * FLOATS_PER_EVENT;
          
          // 0: type (0=note, 1=automation)
          this.floatView[offset + 0] = event.type === 'automation' ? 1 : 0;
          // 1: time
          this.floatView[offset + 1] = event.time;
          // 2: duration
          this.floatView[offset + 2] = event.duration;
          // 3: instrument_id
          this.floatView[offset + 3] = this.getInstrumentId(event.instrument);
          
          if (event.type === 'automation') {
            // 4: controller_id (0=pan, 1=volume, 2=pitchbend)
            let ctrl = 0;
            if (event.controller === 'volume') ctrl = 1;
            else if (event.controller === 'pitchbend') ctrl = 2;
            this.floatView[offset + 4] = ctrl;
            // 5: startValue
            this.floatView[offset + 5] = event.startValue || 0;
            // 15: endValue
            this.floatView[offset + 15] = event.endValue || 0;
            // 20: curve (0=linear, 1=exponential)
            this.floatView[offset + 20] = event.curve === 'exponential' ? 1 : 0;
          } else {
            // 4: note
            this.floatView[offset + 4] = event.note || 0;
            // 5: velocity
            this.floatView[offset + 5] = event.velocity || 80;
            // 6: style (0=synth, 1=concrete)
            this.floatView[offset + 6] = event.style === 'concrete' ? 1 : 0;
            
            // env
            let a = 0.01, d = 0.1, s = 0.5, r = 0.1;
            if (event.env) {
              a = parseFloat(event.env.a || '0.01');
              if (event.env.a?.endsWith('ms')) a /= 1000;
              d = parseFloat(event.env.d || '0.1');
              if (event.env.d?.endsWith('ms')) d /= 1000;
              s = parseFloat(event.env.s || '50') / 100;
              r = parseFloat(event.env.r || '0.1');
              if (event.env.r?.endsWith('ms')) r /= 1000;
            }
            this.floatView[offset + 7] = a;
            this.floatView[offset + 8] = d;
            this.floatView[offset + 9] = s;
            this.floatView[offset + 10] = r;
            
            // 11: buffer_id
            this.floatView[offset + 11] = this.getBufferId(event.src);
            
            // modifiers
            let playbackRate = 1;
            let sliceIdx = 0;
            let glideTime = 0;
            let targetNote = 0;
            
            if (event.modifiers) {
              for (const mod of event.modifiers) {
                if (mod === 'reverse') playbackRate = -1;
                else if (mod.startsWith('slice(')) {
                  const match = mod.match(/slice\(([\d.]+)\)/);
                  if (match) sliceIdx = parseInt(match[1], 10) - 1;
                } else if (mod.startsWith('glide(')) {
                  const match = mod.match(/glide\(([\d.]+)(ms|s)?\)/);
                  if (match) {
                    const val = parseFloat(match[1]);
                    const unit = match[2] || 'ms';
                    glideTime = unit === 's' ? val : val / 1000;
                    targetNote = (event as any).nextNote || 0;
                  }
                }
              }
            }
            
            this.floatView[offset + 12] = playbackRate;
            this.floatView[offset + 13] = sliceIdx;
            this.floatView[offset + 14] = glideTime;
            this.floatView[offset + 15] = targetNote;
            
            // 16: pan
            let pan = event.pan !== undefined ? event.pan : 0;
            let orbitAngle = 0;
            let orbitDist = 0;
            if (event.orbit) {
              orbitAngle = event.orbit.angle;
              orbitDist = event.orbit.dist;
            }
            this.floatView[offset + 16] = pan;
            this.floatView[offset + 17] = orbitAngle;
            this.floatView[offset + 18] = orbitDist;
            
            // 19: fx_dryWet
            this.floatView[offset + 19] = event.fx ? (event.fx.dryWet || 0) : 0;
          }
          
          writeIdx++;
        } else {
          // Fallback Transport: Direct Message (Works in AI Studio Preview)
          this.workletNode.port.postMessage({
            type: 'NOTE',
            event: {
              startTime: event.time, // The absolute context time
              duration: event.duration,
              instrument_id: this.getInstrumentId(event.instrument),
              note: event.note || 0,
              velocity: event.velocity || 80,
              style: event.style === 'concrete' ? 1 : 0,
              a: parseFloat(event.env?.a || '0.01') / (event.env?.a?.endsWith('ms') ? 1000 : 1),
              d: parseFloat(event.env?.d || '0.1') / (event.env?.d?.endsWith('ms') ? 1000 : 1),
              s: parseFloat(event.env?.s || '50') / 100,
              r: parseFloat(event.env?.r || '0.1') / (event.env?.r?.endsWith('ms') ? 1000 : 1),
              bufferId: this.getBufferId(event.src),
              playbackRate: 1, // Add logic for reverse/slice if needed
              sliceIdx: 0,
              glideTime: 0,
              targetNote: (event as any).nextNote || 0,
              pan: event.pan || 0,
              orbitAngle: event.orbit?.angle || 0,
              orbitDist: event.orbit?.dist || 0,
              fxDryWet: event.fx?.dryWet || 0
            }
          });
        }
      }
      
      if (useRingBuffer && this.int32View) {
        Atomics.store(this.int32View, 0, writeIdx);
        const DEBUG = true;
        if (DEBUG) console.log(`[TEDP] SharedBuffer Write Head: ${writeIdx} | Start: ${startTime.toFixed(3)}s`);
      }
      
      this.workletNode.port.postMessage({ type: 'WAKE' });
    }
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
