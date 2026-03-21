// @ts-nocheck
interface AudioEvent {
  type?: 'note' | 'automation';
  time: number;
  note?: number;
  duration: number;
  velocity?: number;
  instrument: string;
  style?: string;
  env?: Record<string, string>;
  src?: string;
  push?: number;
  pull?: number;
  modifiers?: string[];
  pan?: number;
  orbit?: { angle: number, dist: number };
  fx?: { type: string, dryWet: number };
  controller?: number | string;
  startValue?: number;
  endValue?: number;
  curve?: string;
}

class Voice {
  active: boolean = true;
  phase: number = 0;
  time: number = 0;
  
  // Envelope state
  envState: 'A' | 'D' | 'S' | 'R' | 'DONE' = 'A';
  envTime: number = 0;
  currentVol: number = 0;
  
  // Concrete state
  buffer?: Float32Array[];
  bufferIndex: number = 0;
  playbackRate: number = 1;
  isBus: boolean = false;

  // Glide state
  currentFreq: number;
  targetFreq: number;
  glideTime: number;

  constructor(
    public event: AudioEvent,
    public sampleRate: number,
    public a: number,
    public d: number,
    public s: number,
    public r: number,
    public maxVol: number,
    buffer?: Float32Array[],
    isBus: boolean = false,
    busWriteIndex: number = 0
  ) {
    this.buffer = buffer;
    this.isBus = isBus;
    if (isBus) {
      this.bufferIndex = busWriteIndex;
    }
    
    // Frequency
    this.currentFreq = 440 * Math.pow(2, (event.note - 69) / 12);
    this.targetFreq = this.currentFreq;
    this.glideTime = 0;

    if (event.modifiers) {
      for (const mod of event.modifiers) {
        if (mod.startsWith('glide(')) {
          const match = mod.match(/glide\(([\d.]+)(ms|s)?\)/);
          if (match) {
            const val = parseFloat(match[1]);
            const unit = match[2] || 'ms';
            this.glideTime = unit === 's' ? val : val / 1000;
            
            if ((event as any).nextNote) {
               this.targetFreq = 440 * Math.pow(2, ((event as any).nextNote - 69) / 12);
            }
          }
        }
        if (mod === 'reverse') {
          this.playbackRate = -1;
        }
      }
    }
  }

  process(outL: Float32Array, outR: Float32Array, startIdx: number, count: number, currentTime: number, automations: AudioEvent[]) {
    for (let i = 0; i < count; i++) {
      if (this.envState === 'DONE') {
        this.active = false;
        break;
      }

      // Envelope
      if (this.envState === 'A') {
        this.currentVol += (this.maxVol / (this.a * this.sampleRate));
        if (this.time >= this.a) {
          this.envState = 'D';
          this.envTime = 0;
        }
      } else if (this.envState === 'D') {
        const decayDrop = this.maxVol - (this.maxVol * this.s);
        this.currentVol -= (decayDrop / (this.d * this.sampleRate));
        if (this.envTime >= this.d) {
          this.envState = 'S';
          this.envTime = 0;
        }
      } else if (this.envState === 'S') {
        this.currentVol = this.maxVol * this.s;
        if (this.time >= this.event.duration) {
          this.envState = 'R';
          this.envTime = 0;
        }
      } else if (this.envState === 'R') {
        this.currentVol -= ((this.maxVol * this.s) / (this.r * this.sampleRate));
        if (this.envTime >= this.r || this.currentVol <= 0) {
          this.currentVol = 0;
          this.envState = 'DONE';
          this.active = false;
        }
      }

      // Glide
      let freq = this.currentFreq;
      if (this.glideTime > 0 && this.time < this.glideTime) {
        const t = this.time / this.glideTime;
        freq = this.currentFreq + (this.targetFreq - this.currentFreq) * t;
      } else if (this.time >= this.glideTime) {
        freq = this.targetFreq;
      }

      let sample = 0;

      if (this.event.style === 'synth') {
        // Square wave
        const period = this.sampleRate / freq;
        sample = (this.phase % period) < (period / 2) ? 1 : -1;
        this.phase++;
      } else if (this.event.style === 'concrete' && this.buffer) {
        if (this.isBus) {
          // Circular buffer read
          let intIdx = Math.floor(this.bufferIndex);
          if (intIdx < 0) intIdx += this.buffer[0].length;
          intIdx = intIdx % this.buffer[0].length;
          sample = this.buffer[0][intIdx];
          this.bufferIndex += this.playbackRate;
        } else {
          const intIdx = Math.floor(this.bufferIndex);
          if (intIdx >= 0 && intIdx < this.buffer[0].length) {
            sample = this.buffer[0][intIdx];
            this.bufferIndex += this.playbackRate;
          } else {
            this.envState = 'DONE';
            this.active = false;
          }
        }
      }

      sample *= this.currentVol;

      // Panning & Orbit
      let pan = this.event.pan !== undefined ? this.event.pan : 0;
      let distGain = 1;
      let volMultiplier = 1;

      if (this.event.orbit) {
        const angleRad = this.event.orbit.angle * Math.PI / 180;
        pan = Math.sin(angleRad);
        distGain = 1 / (1 + this.event.orbit.dist);
      }

      const sampleTime = currentTime + i / this.sampleRate;

      for (const auto of automations) {
        if (auto.instrument === this.event.instrument) {
          if (sampleTime >= auto.time) {
            let val = auto.endValue!;
            if (sampleTime <= auto.time + auto.duration) {
              const t = (sampleTime - auto.time) / auto.duration;
              if (auto.curve === 'linear') {
                val = auto.startValue! + (auto.endValue! - auto.startValue!) * t;
              } else {
                const start = Math.max(0.001, auto.startValue!);
                const end = Math.max(0.001, auto.endValue!);
                val = start * Math.pow(end / start, t);
              }
            }
            if (auto.controller === 'pan') {
              pan = val;
            } else if (auto.controller === 'volume') {
              volMultiplier = val;
            }
          }
        }
      }

      sample *= volMultiplier;

      // Equal power panning
      const panMapped = (pan + 1) / 2; // 0 to 1
      const gainL = Math.cos(panMapped * Math.PI / 2) * distGain;
      const gainR = Math.sin(panMapped * Math.PI / 2) * distGain;

      outL[startIdx + i] += sample * gainL;
      outR[startIdx + i] += sample * gainR;

      // FX Send (we can output wet signal to additional channels if needed, 
      // but for now we'll handle FX in the main thread by routing the whole worklet output.
      // Wait, if different events have different FX sends, we need separate outputs!)

      const dt = 1 / this.sampleRate;
      this.time += dt;
      this.envTime += dt;
    }
  }
}

class TenutoProcessor extends AudioWorkletProcessor {
  private events: AudioEvent[] = [];
  private activeVoices: Voice[] = [];
  private audioBuffers: Record<string, Float32Array[]> = {};
  private currentFrame: number = 0;
  private isPlaying: boolean = false;

  private activeAutomations: AudioEvent[] = [];
  private busBuffer: Float32Array[] = [];
  private busWriteIndex: number = 0;

  constructor() {
    super();
    // Initialize 10 seconds of stereo bus history
    this.busBuffer = [
      new Float32Array(sampleRate * 10),
      new Float32Array(sampleRate * 10)
    ];
    this.port.onmessage = (e) => {
      if (e.data.type === 'LOAD_BUFFER') {
        this.audioBuffers[e.data.url] = e.data.buffer;
      } else if (e.data.type === 'PLAY') {
        this.events = e.data.events.sort((a: AudioEvent, b: AudioEvent) => a.time - b.time);
        this.currentFrame = 0;
        this.activeVoices = [];
        this.activeAutomations = [];
        this.isPlaying = true;
      } else if (e.data.type === 'STOP') {
        this.isPlaying = false;
        this.events = [];
        this.activeVoices = [];
        this.activeAutomations = [];
      }
    };
  }

  private parseTime(val: string | undefined, defaultVal: number): number {
    if (!val) return defaultVal;
    if (val.endsWith('ms')) return parseFloat(val) / 1000;
    if (val.endsWith('s')) return parseFloat(val);
    return defaultVal;
  }

  private parsePercent(val: string | undefined, defaultVal: number): number {
    if (!val) return defaultVal;
    if (val.endsWith('%')) return parseFloat(val) / 100;
    return defaultVal;
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>) {
    if (!this.isPlaying) return true;

    // Output 0: Dry Mix (Stereo)
    // Output 1: Wet Mix (Stereo) - for FX
    const dryOut = outputs[0];
    const wetOut = outputs.length > 1 ? outputs[1] : outputs[0]; // Fallback if only 1 output

    const channelCount = dryOut.length;
    const frameCount = dryOut[0].length;
    
    // Write inputs to busBuffer
    const input = inputs[0];
    if (input && input.length > 0) {
      for (let i = 0; i < frameCount; i++) {
        this.busBuffer[0][this.busWriteIndex] = input[0][i];
        if (input.length > 1) {
          this.busBuffer[1][this.busWriteIndex] = input[1][i];
        } else {
          this.busBuffer[1][this.busWriteIndex] = input[0][i];
        }
        this.busWriteIndex = (this.busWriteIndex + 1) % this.busBuffer[0].length;
      }
    } else {
      // Advance write index even if no input to keep time synced
      this.busWriteIndex = (this.busWriteIndex + frameCount) % this.busBuffer[0].length;
    }

    const currentTime = this.currentFrame / sampleRate;
    const endTime = (this.currentFrame + frameCount) / sampleRate;

    // Check for new events to trigger
    while (this.events.length > 0 && this.events[0].time < endTime) {
      const event = this.events.shift()!;
      
      if (event.type === 'automation') {
        this.activeAutomations.push(event);
        continue;
      }

      // We only handle synth and concrete in the worklet
      if (event.style === 'synth' || event.style === 'concrete') {
        let a = 0.01, d = 0.1, s = 0.5, r = 0.1;
        if (event.env) {
          a = this.parseTime(event.env.a, a);
          d = this.parseTime(event.env.d, d);
          s = this.parsePercent(event.env.s, s);
          r = this.parseTime(event.env.r, r);
        }

        const maxVol = (event.velocity / 127) * 0.5;
        
        let buffer: Float32Array[] | undefined;
        let isBus = false;
        if (event.style === 'concrete' && event.src) {
          if (event.src.startsWith('bus://')) {
            buffer = this.busBuffer;
            isBus = true;
          } else {
            buffer = this.audioBuffers[event.src];
          }
        }

        const voice = new Voice(event, sampleRate, a, d, s, r, maxVol, buffer, isBus, this.busWriteIndex);
        
        // Handle slice for concrete
        if (event.style === 'concrete' && buffer) {
          let sliceIdx = 0;
          if (event.modifiers) {
            for (const mod of event.modifiers) {
              if (mod.startsWith('slice(')) {
                const match = mod.match(/slice\(([\d.]+)\)/);
                if (match) sliceIdx = parseInt(match[1], 10) - 1;
              }
            }
          }
          if (!isBus) {
            const slices = 8;
            const sliceLen = buffer[0].length / slices;
            voice.bufferIndex = sliceIdx * sliceLen;
          } else {
            // For bus, slice could mean jumping back in time?
            // Let's say slice(1) is current time, slice(2) is 1 second ago, etc.
            voice.bufferIndex -= sliceIdx * sampleRate;
          }
        }

        // Fast-forward voice if it was supposed to start in the past
        const offset = currentTime - event.time;
        if (offset > 0) {
          // In a real implementation we'd advance the voice state, 
          // but for small block sizes (128 samples = ~3ms), it's negligible.
        }

        this.activeVoices.push(voice);
      } else if (event.style === 'standard') {
        // Tell main thread to play soundfont
        this.port.postMessage({ type: 'PLAY_SOUNDFONT', event });
      }
    }

    // Clear outputs
    for (let c = 0; c < dryOut.length; c++) dryOut[c].fill(0);
    if (outputs.length > 1) {
      for (let c = 0; c < wetOut.length; c++) wetOut[c].fill(0);
    }

    // Render voices
    const tempL = new Float32Array(frameCount);
    const tempR = new Float32Array(frameCount);

    for (let v = this.activeVoices.length - 1; v >= 0; v--) {
      const voice = this.activeVoices[v];
      tempL.fill(0);
      tempR.fill(0);
      
      voice.process(tempL, tempR, 0, frameCount, currentTime, this.activeAutomations);
      
      const fx = voice.event.fx;
      const dryWet = fx ? fx.dryWet : 0;
      const dryLevel = 1 - dryWet;
      const wetLevel = dryWet;

      for (let i = 0; i < frameCount; i++) {
        if (dryOut.length > 0) dryOut[0][i] += tempL[i] * dryLevel;
        if (dryOut.length > 1) dryOut[1][i] += tempR[i] * dryLevel;
        
        if (outputs.length > 1) {
          if (wetOut.length > 0) wetOut[0][i] += tempL[i] * wetLevel;
          if (wetOut.length > 1) wetOut[1][i] += tempR[i] * wetLevel;
        }
      }

      if (!voice.active) {
        this.activeVoices.splice(v, 1);
      }
    }

    this.currentFrame += frameCount;
    return true;
  }
}

registerProcessor('tenuto-processor', TenutoProcessor);
