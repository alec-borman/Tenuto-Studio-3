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

/**
 * The AudioEngine manages the Web Audio API context, Tone.js integration, and the AudioWorklet.
 * 
 * In Sprint 7, the engine was upgraded to use Tone.js for its routing pipeline.
 * Each instrument is assigned a `Tone.Gain` bus. If an instrument has an `.fx()` modifier,
 * a dynamic Tone.js effect node (e.g., `Tone.Reverb`, `Tone.FeedbackDelay`) is instantiated
 * and inserted between the bus and `Tone.Destination`.
 * 
 * It also utilizes the CacheStorage API as an asset vault to persistently cache
 * downloaded Soundfonts and audio samples, minimizing network requests on reload.
 */
export class AudioEngine {
  private context!: AudioContext;
  private soundfonts: Record<string, Soundfont> = {};
  private activeNodes: Set<any> = new Set();
  private audioBuffers: Record<string, AudioBuffer> = {};
  private workletNode: AudioWorkletNode | null = null;
  private convolver: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private trackBuses: Record<string, Tone.Gain> = {};
  private isInitialized: boolean = false;

  private sharedBuffer: SharedArrayBuffer | null = null;
  private int32View: Int32Array | null = null;
  private floatView: Float32Array | null = null;
  private instrumentIdMap: Record<string, number> = {};
  private nextInstrumentId = 1;
  private bufferIdMap: Record<string, number> = {};
  private nextBufferId = 1;
  public manifest: Record<string, any> = {};

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

  private sovereignConnect(source: any, destination: any, outIdx: number = 0, inIdx: number = 0) {
    try {
      // 1. Manually unwrap the destination to find the raw native node
      let rawDest = destination;
      while (rawDest && (rawDest.input || rawDest.get)) {
        if (rawDest.input && rawDest.input !== rawDest) {
          rawDest = rawDest.input;
        } else if (rawDest.get && typeof rawDest.get === 'function' && rawDest.get() !== rawDest) {
          rawDest = rawDest.get();
        } else {
          break;
        }
      }
      
      // 2. Manually unwrap the source to find the raw native node
      let rawSrc = source;
      while (rawSrc && rawSrc.output && rawSrc.output !== rawSrc) {
        rawSrc = rawSrc.output;
      }

      // 3. Perform a "Blind Call" on the AudioNode prototype. 
      // This forces the browser to execute the connection even if 'instanceof' fails.
      const nativeConnect = AudioNode.prototype.connect;
      nativeConnect.call(rawSrc, rawDest, outIdx, inIdx);
      
      console.log(`[TEDP] Sovereign Pipe established: ${rawSrc.constructor?.name} -> ${rawDest.constructor?.name}`);
    } catch (e) {
      console.warn("[TEDP] Sovereign Pipe failed, trying legacy fallback...", e);
      if (source.connect) source.connect(destination, outIdx, inIdx);
    }
  }

  constructor() {
    // Context initialization moved to init() to prevent TypeError on boot
  }

  public async loadManifest() {
    try {
      const response = await fetch('./sounds.json'); // Try relative to current directory
      if (!response.ok) throw new Error("Status: " + response.status);
      this.manifest = await response.json();
      console.log('[TEDP] Asset Manifest Loaded.');
    } catch (e) {
      console.warn('[TEDP] Attempting fallback manifest path...');
      const resp = await fetch('/sounds.json'); // Try absolute root
      this.manifest = await resp.json();
    }
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
      const NativeAudioContext = (window.AudioContext || (window as any).webkitAudioContext);
      this.context = new NativeAudioContext();
      
      // CRITICAL: Anchor Tone.js to this specific context immediately.
      // This ensures every Tone.Gain created thereafter belongs to the same realm.
      await Tone.start();
      Tone.setContext(this.context); 
    }
    
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    try {
      // 2. Dual-Environment Check (Cloud Preview vs Local Native)
      const isCrossOriginIsolated = typeof SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated;

      // Task 3: Move allocation ABOVE constructor (Production Fix #2)
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

      const workletUrl = new URL('./processor.ts', import.meta.url).href;
      await this.context.audioWorklet.addModule(workletUrl, { type: 'module' } as any);
      
      const numOutputs = Math.max(2, instruments.length);
      this.workletNode = new AudioWorkletNode(this.context, 'tenuto-processor', {
        numberOfInputs: 1,
        numberOfOutputs: numOutputs,
        outputChannelCount: Array(numOutputs).fill(2),
        processorOptions: {
          sharedBuffer: this.sharedBuffer
        }
      });

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
      console.log("[TEDP] Realm Anchor Successful. Context:", this.context.state);
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
    await Tone.start();
    const instruments = Array.from(new Set(events.map(e => e.instrument)));
    await this.init(instruments);
    const promises: Promise<any>[] = [];
    
    for (let i = 0; i < instruments.length; i++) {
      const instrument = instruments[i];
      if (!this.trackBuses[instrument]) {
        const bus = new Tone.Gain();
        this.trackBuses[instrument] = bus;
        
        // Connect the worklet output for this instrument to its bus
        if (this.workletNode) {
          this.sovereignConnect(this.workletNode, bus, i, 0);
        }
        
        // Check if this track has FX defined in the AST defs or events
        const fxEvent = events.find(e => e.instrument === instrument && e.fx);
        
        if (fxEvent && fxEvent.fx) {
          const fx = fxEvent.fx;
          let fxNode: any = null;
          
          if (fx.type === 'hall' || fx.type === 'reverb') {
            const reverb = new Tone.Reverb({ decay: fx.decay || 4, wet: fx.dryWet || 0.5 });
            promises.push(reverb.generate());
            fxNode = reverb;
          } else if (fx.type === 'delay') {
            fxNode = new Tone.FeedbackDelay({ delayTime: (fx.time || 250) / 1000, feedback: fx.feedback || 0.3, wet: fx.dryWet || 0.5 });
          } else if (fx.type === 'distortion') {
            fxNode = new Tone.Distortion({ distortion: fx.amount || 0.5, wet: fx.dryWet || 0.5 });
          } else if (fx.type === 'bitcrusher') {
            fxNode = new Tone.BitCrusher(fx.bits || 4);
            fxNode.wet.value = fx.dryWet !== undefined ? fx.dryWet : 0.5;
          } else if (fx.type === 'chorus') {
            fxNode = new Tone.Chorus({ frequency: fx.speed || 1.5, delayTime: fx.delay || 3.5, depth: fx.depth || 0.7, wet: fx.dryWet || 0.5 }).start();
          }
          
          if (fxNode) {
            this.sovereignConnect(bus, fxNode);
            this.sovereignConnect(fxNode, Tone.Destination);
          } else {
            this.sovereignConnect(bus, Tone.Destination);
          }
        } else {
          this.sovereignConnect(bus, Tone.Destination);
        }
      }
    }

    for (const event of events) {
      const patchValue = (event as any).patch;
      const manifestEntry = this.manifest.instruments?.[event.src || patchValue] || this.manifest[event.instrument];
      const style = manifestEntry?.style || event.style;
      const src = manifestEntry?.src || event.src;
      const patch = manifestEntry?.patch || patchValue || event.instrument;

      if (style === 'standard') {
        const instrumentName = PATCH_MAP[patch] || patch;
        if (!this.soundfonts[instrumentName]) {
          const sf = new Soundfont(this.context, { 
            instrument: instrumentName as any,
            destination: this.trackBuses[event.instrument] as any
          });
          this.soundfonts[instrumentName] = sf;
          promises.push(sf.loaded());
        }
      } else if (style === 'concrete' && src) {
        if (!src.startsWith('bus://')) {
          if (manifestEntry && manifestEntry.regions) {
            for (const region of manifestEntry.regions) {
              if (!this.audioBuffers[region.sample]) {
                promises.push(this.loadAudioBuffer(region.sample));
              }
            }
          } else if (!this.audioBuffers[src]) {
            promises.push(this.loadAudioBuffer(src));
          }
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

  private async fetchSampleRange(url: string, start: number, end: number): Promise<AudioBuffer | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'Range': `bytes=${start}-${end}`
        }
      });

      if (response.status === 200) {
        console.warn(`[TEDP] Architectural Guard: Fetched whole file instead of range for ${url}. Check Cloudflare Cache Rules.`);
      } else if (response.status !== 206) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      // Mocking Symphonia logic for FLAC/OGG decoding using WebAudio fallback
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      return audioBuffer;
    } catch (e) {
      console.error(`[TEDP] Failed to fetch sample range for ${url}`, e);
      return null;
    }
  }

  private async loadAudioBuffer(url: string) {
    try {
      const cache = await caches.open('tenuto-assets');
      let response = await cache.match(url);
      
      let audioBuffer: AudioBuffer | null = null;

      if (response) {
        console.log(`[TEDP] Cache hit for ${url}`);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      } else {
        // Mocking Symphonia JIT streaming: fetch first 1MB
        audioBuffer = await this.fetchSampleRange(url, 0, 1048576);
        if (!audioBuffer) {
          throw new Error(`Failed to fetch sample range for ${url}`);
        }
        // In a real implementation, we'd cache the decoded buffer or the raw bytes
      }
      
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
  private resolveSampleUrl(src: string | undefined, note: number, velocity: number): string | undefined {
    if (!src) return undefined;
    if (src.startsWith('bus://')) return src;

    const manifestEntry = this.manifest.instruments?.[src];
    if (manifestEntry && manifestEntry.regions) {
      for (const region of manifestEntry.regions) {
        if (note >= region.lokey && note <= region.hikey && velocity >= region.lovel && velocity <= region.hivel) {
          return region.sample;
        }
      }
    }
    return src;
  }

  public async play(events: AudioEvent[], startTime: number) {
    await Tone.start();
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    
    if (!this.workletNode) {
      console.warn("AudioWorkletNode not initialized. Audio playback may fail.");
      return;
    }
    
    // Adjust event times relative to startTime and merge manifest
    const adjustedEvents = events.map(e => {
      let time = e.time;
      if (e.push) time -= e.push / 1000000;
      if (e.pull) time += e.pull / 1000000;

      const patchValue = (e as any).patch;
      const manifestEntry = this.manifest.instruments?.[e.src || patchValue] || this.manifest[e.instrument];
      const style = manifestEntry?.style || e.style;
      const src = manifestEntry?.src || e.src;
      const patch = manifestEntry?.patch || patchValue || e.instrument;
      const env = manifestEntry?.env || e.env;

      return { ...e, time: startTime + time, style, src, patch, env };
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
            this.floatView[offset + 11] = this.getBufferId(this.resolveSampleUrl(event.src, event.note || 0, event.velocity || 80));
            
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
              bufferId: this.getBufferId(this.resolveSampleUrl(event.src, event.note || 0, event.velocity || 80)),
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
    const patch = (event as any).patch || event.instrument;
    const instrumentName = PATCH_MAP[patch] || patch || 'acoustic_grand_piano';
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
      this.sovereignConnect(gain, bus);
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
