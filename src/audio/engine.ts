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
  private context: AudioContext;
  private soundfonts: Record<string, Soundfont> = {};
  private activeNodes: Set<any> = new Set();
  private audioBuffers: Record<string, AudioBuffer> = {};

  constructor() {
    this.context = Tone.getContext().rawContext as AudioContext;
  }

  public async loadInstruments(events: AudioEvent[]) {
    const promises: Promise<void>[] = [];
    
    for (const event of events) {
      if (event.style === 'standard') {
        const instrumentName = PATCH_MAP[event.instrument] || 'acoustic_grand_piano';
        if (!this.soundfonts[instrumentName]) {
          this.soundfonts[instrumentName] = new Soundfont(this.context, { instrument: instrumentName });
          // smplr loads asynchronously, but we don't have a promise API for it directly here
          // It will play when loaded.
        }
      } else if (event.style === 'concrete' && event.src) {
        if (!this.audioBuffers[event.src]) {
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
    } catch (e) {
      console.error(`Failed to load concrete audio from ${url}`, e);
    }
  }

  public schedule(event: AudioEvent, startTime: number) {
    let scheduleTime = startTime + event.time;
    
    // Apply micro-timing (push/pull in microseconds)
    if (event.push) scheduleTime -= event.push / 1000000;
    if (event.pull) scheduleTime += event.pull / 1000000;
    
    if (scheduleTime < this.context.currentTime) {
      scheduleTime = this.context.currentTime;
    }

    if (event.style === 'standard') {
      const instrumentName = PATCH_MAP[event.instrument] || 'acoustic_grand_piano';
      const sf = this.soundfonts[instrumentName];
      if (sf) {
        sf.start({
          note: event.note,
          velocity: event.velocity,
          time: scheduleTime,
          duration: event.duration
        });
      }
    } else if (event.style === 'synth') {
      this.scheduleSynth(event, scheduleTime);
    } else if (event.style === 'concrete') {
      this.scheduleConcrete(event, scheduleTime);
    }
  }

  private scheduleSynth(event: AudioEvent, scheduleTime: number) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'square'; // Default, could be configurable
    
    // Convert MIDI note to frequency
    const freq = 440 * Math.pow(2, (event.note - 69) / 12);
    osc.frequency.setValueAtTime(freq, scheduleTime);
    
    if (event.modifiers) {
      for (const mod of event.modifiers) {
        if (mod.startsWith('glide(')) {
          const match = mod.match(/glide\(([\d.]+)(ms|s)?\)/);
          if (match) {
            const timeVal = match[1] + (match[2] || 'ms');
            const glideTime = this.parseTime(timeVal);
            
            let targetNote = event.note;
            if (event.nextNote !== undefined) {
              targetNote = event.nextNote;
            } else {
              // Fallback if no next note
              targetNote = event.note - 12;
            }
            const targetFreq = 440 * Math.pow(2, (targetNote - 69) / 12);
            osc.frequency.linearRampToValueAtTime(targetFreq, scheduleTime + glideTime);
          }
        }
      }
    }
    
    // Parse env=@{ a: 5ms, d: 1s, s: 100%, r: 50ms }
    let a = 0.01;
    let d = 0.1;
    let s = 0.5;
    let r = 0.1;
    
    if (event.env) {
      if (event.env.a) a = this.parseTime(event.env.a);
      if (event.env.d) d = this.parseTime(event.env.d);
      if (event.env.s) s = this.parsePercent(event.env.s);
      if (event.env.r) r = this.parseTime(event.env.r);
    }
    
    const maxVol = (event.velocity / 127) * 0.5; // Scale down to avoid clipping
    
    gain.gain.setValueAtTime(0, scheduleTime);
    gain.gain.linearRampToValueAtTime(maxVol, scheduleTime + a);
    gain.gain.linearRampToValueAtTime(maxVol * s, scheduleTime + a + d);
    
    const stopTime = scheduleTime + event.duration;
    gain.gain.setValueAtTime(maxVol * s, stopTime);
    gain.gain.linearRampToValueAtTime(0, stopTime + r);
    
    osc.connect(gain);
    gain.connect(this.context.destination);
    
    osc.start(scheduleTime);
    osc.stop(stopTime + r);
    
    this.activeNodes.add(osc);
    osc.onended = () => {
      this.activeNodes.delete(osc);
      osc.disconnect();
      gain.disconnect();
    };
  }

  private scheduleConcrete(event: AudioEvent, scheduleTime: number) {
    if (!event.src || !this.audioBuffers[event.src]) return;
    
    let buffer = this.audioBuffers[event.src];
    
    let sliceNum = 1;
    if (event.modifiers) {
      for (const mod of event.modifiers) {
        if (mod.startsWith('slice(')) {
          const match = mod.match(/slice\((\d+)\)/);
          if (match) {
            sliceNum = parseInt(match[1], 10);
          }
        }
      }
    }
    
    // Simple slicing logic: divide buffer into 4 slices
    const numSlices = 4;
    const sliceDuration = buffer.duration / numSlices;
    
    // Ensure sliceNum is within bounds (1-indexed)
    const actualSlice = Math.max(1, Math.min(numSlices, sliceNum)) - 1;
    
    const offset = actualSlice * sliceDuration;
    const duration = Math.min(event.duration, sliceDuration);
    
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    
    const gain = this.context.createGain();
    const maxVol = (event.velocity / 127);
    
    // Simple envelope to avoid clicks
    gain.gain.setValueAtTime(0, scheduleTime);
    gain.gain.linearRampToValueAtTime(maxVol, scheduleTime + 0.01);
    gain.gain.setValueAtTime(maxVol, scheduleTime + duration - 0.01);
    gain.gain.linearRampToValueAtTime(0, scheduleTime + duration);
    
    source.connect(gain);
    gain.connect(this.context.destination);
    
    source.start(scheduleTime, offset, duration);
    
    this.activeNodes.add(source);
    source.onended = () => {
      this.activeNodes.delete(source);
      source.disconnect();
      gain.disconnect();
    };
  }

  private parseTime(val: string): number {
    if (val.endsWith('ms')) return parseFloat(val) / 1000;
    if (val.endsWith('s')) return parseFloat(val);
    return parseFloat(val) / 1000; // Default to ms
  }

  private parsePercent(val: string): number {
    if (val.endsWith('%')) return parseFloat(val) / 100;
    return parseFloat(val);
  }

  public stopAll() {
    for (const key in this.soundfonts) {
      this.soundfonts[key].stop();
    }
    for (const node of this.activeNodes) {
      try {
        node.stop();
      } catch (e) {}
    }
    this.activeNodes.clear();
  }
}
