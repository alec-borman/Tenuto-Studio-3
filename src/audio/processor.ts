// @ts-nocheck

class Automation {
  active: boolean = false;
  time: number = 0;
  duration: number = 0;
  instrumentId: number = 0;
  controller: number = 0;
  startValue: number = 0;
  endValue: number = 0;
  curve: number = 0;

  init(time: number, duration: number, instrumentId: number, controller: number, startValue: number, endValue: number, curve: number) {
    this.active = true;
    this.time = time;
    this.duration = duration;
    this.instrumentId = instrumentId;
    this.controller = controller;
    this.startValue = startValue;
    this.endValue = endValue;
    this.curve = curve;
  }
}

class Voice {
  active: boolean = false;
  phase: number = 0;
  time: number = 0;
  
  envState: 'A' | 'D' | 'S' | 'R' | 'DONE' = 'A';
  envTime: number = 0;
  currentVol: number = 0;
  
  buffer?: Float32Array[];
  bufferIndex: number = 0;
  playbackRate: number = 1;
  isBus: boolean = false;
  
  currentFreq: number = 440;
  targetFreq: number = 440;
  glideTime: number = 0;

  duration: number = 0;
  instrumentId: number = 0;
  note: number = 0;
  style: number = 0;
  a: number = 0.01;
  d: number = 0.1;
  s: number = 0.5;
  r: number = 0.1;
  maxVol: number = 0;
  pan: number = 0;
  orbitAngle: number = 0;
  orbitDist: number = 0;
  fxDryWet: number = 0;

  sampleRate: number = 44100;

  init(
    sampleRate: number,
    duration: number,
    instrumentId: number,
    note: number,
    velocity: number,
    style: number,
    a: number, d: number, s: number, r: number,
    buffer: Float32Array[] | undefined,
    isBus: boolean,
    busWriteIndex: number,
    playbackRate: number,
    sliceIdx: number,
    glideTime: number,
    targetNote: number,
    pan: number,
    orbitAngle: number,
    orbitDist: number,
    fxDryWet: number
  ) {
    this.active = true;
    this.phase = 0;
    this.time = 0;
    this.envState = 'A';
    this.envTime = 0;
    this.currentVol = 0;
    
    this.sampleRate = sampleRate;
    this.duration = duration;
    this.instrumentId = instrumentId;
    this.note = note;
    this.style = style;
    this.a = a;
    this.d = d;
    this.s = s;
    this.r = r;
    this.maxVol = (velocity / 127) * 0.5;
    
    this.buffer = buffer;
    this.isBus = isBus;
    if (isBus) {
      this.bufferIndex = busWriteIndex;
      if (sliceIdx > 0) {
        this.bufferIndex -= sliceIdx * sampleRate;
      }
    } else if (buffer) {
      const slices = 8;
      const sliceLen = buffer[0].length / slices;
      this.bufferIndex = sliceIdx * sliceLen;
    } else {
      this.bufferIndex = 0;
    }
    
    this.playbackRate = playbackRate;
    
    this.currentFreq = 440 * Math.pow(2, (note - 69) / 12);
    this.targetFreq = targetNote > 0 ? 440 * Math.pow(2, (targetNote - 69) / 12) : this.currentFreq;
    this.glideTime = glideTime;
    
    this.pan = pan;
    this.orbitAngle = orbitAngle;
    this.orbitDist = orbitDist;
    this.fxDryWet = fxDryWet;
  }

  process(outL: Float32Array, outR: Float32Array, startIdx: number, count: number, currentTime: number, automations: Automation[]) {
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
        if (this.time >= this.duration) {
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

      // Panning & Orbit
      let currentPan = this.pan;
      let distGain = 1;
      let volMultiplier = 1;
      let pitchBend = 8192;

      if (this.orbitAngle !== 0 || this.orbitDist !== 0) {
        const angleRad = this.orbitAngle * Math.PI / 180;
        currentPan = Math.sin(angleRad);
        distGain = 1 / (1 + this.orbitDist);
      }

      const sampleTime = currentTime + i / this.sampleRate;

      for (let a = 0; a < automations.length; a++) {
        const auto = automations[a];
        if (!auto.active) continue;
        if (auto.instrumentId === this.instrumentId) {
          if (sampleTime >= auto.time) {
            let val = auto.endValue;
            if (sampleTime <= auto.time + auto.duration) {
              const t = (sampleTime - auto.time) / auto.duration;
              if (auto.curve === 0) { // linear
                val = auto.startValue + (auto.endValue - auto.startValue) * t;
              } else { // exponential
                const start = Math.max(0.001, auto.startValue);
                const end = Math.max(0.001, auto.endValue);
                val = start * Math.pow(end / start, t);
              }
            }
            if (auto.controller === 0) { // pan
              currentPan = val;
            } else if (auto.controller === 1) { // volume
              volMultiplier = val;
            } else if (auto.controller === 2) { // pitchbend
              pitchBend = val;
            }
          }
        }
      }

      // Apply pitchbend to freq
      if (pitchBend !== 8192) {
        const bendSemitones = ((pitchBend - 8192) / 8192) * 2;
        freq = freq * Math.pow(2, bendSemitones / 12);
      }

      let sample = 0;

      if (this.style === 0) { // synth
        const period = this.sampleRate / freq;
        sample = (this.phase % period) < (period / 2) ? 1 : -1;
        this.phase++;
      } else if (this.style === 1 && this.buffer) { // concrete
        let currentPlaybackRate = this.playbackRate;
        if (pitchBend !== 8192) {
          const bendSemitones = ((pitchBend - 8192) / 8192) * 2;
          currentPlaybackRate *= Math.pow(2, bendSemitones / 12);
        }

        if (this.isBus) {
          let intIdx = Math.floor(this.bufferIndex);
          if (intIdx < 0) intIdx += this.buffer[0].length;
          intIdx = intIdx % this.buffer[0].length;
          sample = this.buffer[0][intIdx];
          this.bufferIndex += currentPlaybackRate;
        } else {
          const intIdx = Math.floor(this.bufferIndex);
          if (intIdx >= 0 && intIdx < this.buffer[0].length) {
            sample = this.buffer[0][intIdx];
            this.bufferIndex += currentPlaybackRate;
          } else {
            this.envState = 'DONE';
            this.active = false;
          }
        }
      }

      sample *= this.currentVol;
      sample *= volMultiplier;

      const panMapped = (currentPan + 1) / 2;
      const gainL = Math.cos(panMapped * Math.PI / 2) * distGain;
      const gainR = Math.sin(panMapped * Math.PI / 2) * distGain;

      outL[startIdx + i] += sample * gainL;
      outR[startIdx + i] += sample * gainR;

      const dt = 1 / this.sampleRate;
      this.time += dt;
      this.envTime += dt;
    }
  }
}

class TenutoProcessor extends AudioWorkletProcessor {
  private voices: Voice[] = [];
  private pendingNotes: any[] = []; // Waiting room for postMessage notes
  private automations: Automation[] = [];
  private audioBuffers: Record<number, Float32Array[]> = {};
  private isPlaying: boolean = false;

  private busBuffer: Float32Array[] = [];
  private busWriteIndex: number = 0;

  private sharedBuffer: SharedArrayBuffer | null = null;
  private int32View: Int32Array | null = null;
  private floatView: Float32Array | null = null;

  private MAX_EVENTS = 1024;
  private FLOATS_PER_EVENT = 24;

  constructor() {
    super();
    
    // Pre-allocate 128 voices
    for (let i = 0; i < 128; i++) {
      this.voices.push(new Voice());
    }

    // Pre-allocate 64 automations
    for (let i = 0; i < 64; i++) {
      this.automations.push(new Automation());
    }

    this.busBuffer = [
      new Float32Array(sampleRate * 10),
      new Float32Array(sampleRate * 10)
    ];

    this.port.onmessage = (e) => {
      if (e.data.type === 'INIT') {
        this.sharedBuffer = e.data.sharedBuffer;
        if (this.sharedBuffer) {
          this.int32View = new Int32Array(this.sharedBuffer, 0, 2);
          this.floatView = new Float32Array(this.sharedBuffer, 8);
        }
        this.isPlaying = true;
      } else if (e.data.type === 'NOTE') {
        // Push to pending queue instead of instant init
        this.pendingNotes.push(e.data.event);
      } else if (e.data.type === 'LOAD_BUFFER') {
        this.audioBuffers[e.data.bufferId] = e.data.buffer;
      } else if (e.data.type === 'WAKE') {
        this.isPlaying = true;
      } else if (e.data.type === 'STOP') {
        this.isPlaying = false;
        this.pendingNotes = [];
        for (let i = 0; i < this.voices.length; i++) this.voices[i].active = false;
        for (let i = 0; i < this.automations.length; i++) this.automations[i].active = false;
        if (this.int32View) {
          Atomics.store(this.int32View, 0, 0); // writeIdx
          Atomics.store(this.int32View, 1, 0); // readIdx
        }
      }
    };
  }

  private getInactiveVoice(): Voice | null {
    for (let i = 0; i < this.voices.length; i++) {
      if (!this.voices[i].active) return this.voices[i];
    }
    return null;
  }

  private getInactiveAutomation(): Automation | null {
    for (let i = 0; i < this.automations.length; i++) {
      if (!this.automations[i].active) return this.automations[i];
    }
    return null;
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>) {
    if (!this.isPlaying) return true;

    const frameCount = outputs[0][0].length;
    
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
      this.busWriteIndex = (this.busWriteIndex + frameCount) % this.busBuffer[0].length;
    }

    const currentCtxTime = currentTime;
    const endCtxTime = currentCtxTime + frameCount / sampleRate;

    // 1. Process Pending Messages (The Clock Sync)
    for (let i = this.pendingNotes.length - 1; i >= 0; i--) {
      const msg = this.pendingNotes[i];
      if (currentCtxTime >= msg.startTime) {
        const voice = this.getInactiveVoice();
        if (voice) {
          voice.init(
            sampleRate, msg.duration, msg.instrument_id, msg.note, msg.velocity, msg.style,
            msg.a, msg.d, msg.s, msg.r, 
            msg.bufferId === -1 ? this.busBuffer : this.audioBuffers[msg.bufferId],
            msg.bufferId === -1, this.busWriteIndex,
            msg.playbackRate || 1, msg.sliceIdx || 0, msg.glideTime || 0, msg.targetNote || 0,
            msg.pan || 0, msg.orbitAngle || 0, msg.orbitDist || 0, msg.fxDryWet || 0
          );
        }
        this.pendingNotes.splice(i, 1);
      }
    }

    // 2. Process Ring Buffer (If available)
    if (this.int32View && this.floatView) {
      let writeIdx = Atomics.load(this.int32View, 0);
      let readIdx = Atomics.load(this.int32View, 1);

      while (readIdx < writeIdx) {
        const offset = (readIdx % this.MAX_EVENTS) * this.FLOATS_PER_EVENT;
        const eventTime = this.floatView[offset + 1];

        // If event is in the future, stop reading
        if (eventTime >= endCtxTime) {
          break;
        }

        const type = this.floatView[offset + 0];
        const duration = this.floatView[offset + 2];
        const instrumentId = this.floatView[offset + 3];

        if (type === 1) { // Automation
          const controller = this.floatView[offset + 4];
          const startValue = this.floatView[offset + 5];
          const endValue = this.floatView[offset + 15];
          const curve = this.floatView[offset + 20];

          const auto = this.getInactiveAutomation();
          if (auto) {
            auto.init(eventTime, duration, instrumentId, controller, startValue, endValue, curve);
          }
        } else { // Note
          const note = this.floatView[offset + 4];
          const velocity = this.floatView[offset + 5];
          const style = this.floatView[offset + 6];
          const a = this.floatView[offset + 7];
          const d = this.floatView[offset + 8];
          const s = this.floatView[offset + 9];
          const r = this.floatView[offset + 10];
          const bufferId = this.floatView[offset + 11];
          const playbackRate = this.floatView[offset + 12];
          const sliceIdx = this.floatView[offset + 13];
          const glideTime = this.floatView[offset + 14];
          const targetNote = this.floatView[offset + 15];
          const pan = this.floatView[offset + 16];
          const orbitAngle = this.floatView[offset + 17];
          const orbitDist = this.floatView[offset + 18];
          const fxDryWet = this.floatView[offset + 19];

          let buffer: Float32Array[] | undefined;
          let isBus = false;

          if (style === 1) { // concrete
            if (bufferId === -1) {
              buffer = this.busBuffer;
              isBus = true;
            } else if (bufferId > 0) {
              buffer = this.audioBuffers[bufferId];
            }
          }

          const voice = this.getInactiveVoice();
          if (voice) {
            voice.init(
              sampleRate, duration, instrumentId, note, velocity, style,
              a, d, s, r, buffer, isBus, this.busWriteIndex,
              playbackRate, sliceIdx, glideTime, targetNote,
              pan, orbitAngle, orbitDist, fxDryWet
            );
          }
        }

        const DEBUG = true;
        if (DEBUG && readIdx % 16 === 0) console.log(`[DSP] Read Head: ${readIdx} | Active Voices: ${this.voices.filter(v => v.active).length}`);

        readIdx++;
      }

      Atomics.store(this.int32View, 1, readIdx);
    }

    // Clear outputs
    for (let outIdx = 0; outIdx < outputs.length; outIdx++) {
      if (outputs[outIdx]) {
        for (let c = 0; c < outputs[outIdx].length; c++) {
          outputs[outIdx][c].fill(0);
        }
      }
    }

    // 3. Render Voices to CORRECT outputs
    for (let v = 0; v < this.voices.length; v++) {
      const voice = this.voices[v];
      if (!voice.active) continue;

      const tempL = new Float32Array(frameCount);
      const tempR = new Float32Array(frameCount);
      voice.process(tempL, tempR, 0, frameCount, currentCtxTime, this.automations);

      // FIX: Write to the specific output index for this instrument
      // If instrument_id is 1, it maps to outputs[0] (0-indexed)
      const outIdx = Math.max(0, voice.instrumentId - 1);
      if (outputs[outIdx]) {
        for (let i = 0; i < frameCount; i++) {
          outputs[outIdx][0][i] += tempL[i];
          if (outputs[outIdx].length > 1) outputs[outIdx][1][i] += tempR[i];
        }
      }
    }

    // Cleanup old automations
    for (let a = 0; a < this.automations.length; a++) {
      const auto = this.automations[a];
      if (auto.active && currentCtxTime > auto.time + auto.duration) {
        auto.active = false;
      }
    }

    return true;
  }
}

registerProcessor('tenuto-processor', TenutoProcessor);
