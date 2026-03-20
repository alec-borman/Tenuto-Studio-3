import { AST, Measure, Part, Voice, Event, Note, Chord, Tuplet, MacroCall } from './parser';

export class MIDIGenerator {
  public generate(ast: AST): Uint8Array {
    // A very basic MIDI generator
    // We'll use a simple approach to build a MIDI file byte array
    
    const tracks: Uint8Array[] = [];
    
    // Track 0: Tempo and Time Signature
    const track0 = this.createTrack0(ast);
    tracks.push(track0);
    
    // Track 1..N: Instrument tracks
    for (let i = 0; i < ast.defs.length; i++) {
      const def = ast.defs[i];
      const track = this.createInstrumentTrack(ast, def, i);
      tracks.push(track);
    }
    
    // Build the final MIDI file
    return this.buildMidiFile(tracks);
  }
  
  private createTrack0(ast: AST): Uint8Array {
    const events: number[] = [];
    
    // Time signature (4/4 default)
    let num = 4, den = 4;
    if (ast.meta.time) {
      const parts = ast.meta.time.split('/');
      num = parseInt(parts[0], 10);
      den = parseInt(parts[1], 10);
    }
    const denPower = Math.log2(den);
    
    events.push(0x00, 0xFF, 0x58, 0x04, num, denPower, 0x18, 0x08);
    
    // Tempo (120 default)
    let tempo = 120;
    if (ast.meta.tempo) {
      tempo = parseInt(ast.meta.tempo, 10);
    }
    const microsecondsPerBeat = Math.round(60000000 / tempo);
    
    events.push(0x00, 0xFF, 0x51, 0x03, 
      (microsecondsPerBeat >> 16) & 0xFF,
      (microsecondsPerBeat >> 8) & 0xFF,
      microsecondsPerBeat & 0xFF
    );
    
    // End of track
    events.push(0x00, 0xFF, 0x2F, 0x00);
    
    return this.buildTrack(events);
  }
  
  private createInstrumentTrack(ast: AST, def: any, channel: number): Uint8Array {
    // We will use a simplified approach: absolute time in ticks, then convert to delta times
    // 480 ticks per quarter note
    const TICKS_PER_QUARTER = 480;
    
    interface MidiEvent {
      time: number;
      type: 'noteOn' | 'noteOff' | 'pitchBend';
      note?: number;
      velocity?: number;
      value?: number;
    }
    
    const midiEvents: MidiEvent[] = [];
    
    let currentTime = 0;
    
    for (const measure of ast.measures) {
      const part = measure.parts.find(p => p.id === def.id);
      if (part) {
        const voice = part.voices[0];
        if (voice) {
          let voiceTime = currentTime;
          for (const event of voice.events) {
            if (event.type === 'note') {
              const ticks = this.durationToTicks(event.duration, TICKS_PER_QUARTER);
              if (event.pitch !== 'r') {
                const midiNote = this.pitchToMidi(event.pitch, event.octave, event.accidental);
                
                // Microtonal playback
                let bend = 8192;
                if (event.accidental === '+') bend = 8192 + 2048; // Quarter sharp
                if (event.accidental === '-') bend = 8192 - 2048; // Quarter flat
                
                let velocity = 80;
                if (event.articulation === 'f') velocity = 100;
                if (event.articulation === 'p') velocity = 60;
                if (event.articulation === 'ff') velocity = 120;
                if (event.articulation === 'pp') velocity = 40;
                
                let timeOffset = 0;
                if (event.push) timeOffset = -event.push;
                if (event.pull) timeOffset = event.pull;
                const actualTime = Math.max(0, voiceTime + timeOffset);
                
                if (bend !== 8192) {
                  midiEvents.push({ time: actualTime, type: 'pitchBend', value: bend });
                }
                
                midiEvents.push({ time: actualTime, type: 'noteOn', note: midiNote, velocity });
                midiEvents.push({ time: actualTime + ticks, type: 'noteOff', note: midiNote, velocity: 0 });
                
                if (bend !== 8192) {
                  // Reset pitch bend after note
                  midiEvents.push({ time: actualTime + ticks, type: 'pitchBend', value: 8192 });
                }
              }
              voiceTime += ticks;
            } else if (event.type === 'chord') {
              const ticks = this.durationToTicks(event.duration, TICKS_PER_QUARTER);
              
              let timeOffset = 0;
              if (event.push) timeOffset = -event.push;
              if (event.pull) timeOffset = event.pull;
              const actualTime = Math.max(0, voiceTime + timeOffset);
              
              for (const note of event.notes) {
                if (note.pitch !== 'r') {
                  const midiNote = this.pitchToMidi(note.pitch, note.octave, note.accidental);
                  
                  let bend = 8192;
                  if (note.accidental === '+') bend = 8192 + 2048;
                  if (note.accidental === '-') bend = 8192 - 2048;
                  
                  if (bend !== 8192) {
                    midiEvents.push({ time: actualTime, type: 'pitchBend', value: bend });
                  }
                  
                  midiEvents.push({ time: actualTime, type: 'noteOn', note: midiNote, velocity: 80 });
                  midiEvents.push({ time: actualTime + ticks, type: 'noteOff', note: midiNote, velocity: 0 });
                  
                  if (bend !== 8192) {
                    midiEvents.push({ time: actualTime + ticks, type: 'pitchBend', value: 8192 });
                  }
                }
              }
              voiceTime += ticks;
            } else if (event.type === 'macro_call') {
              const macro = ast.macros.find(m => m.id === event.id);
              if (macro) {
                for (const e of macro.events) {
                  if (e.type === 'note') {
                    const ticks = this.durationToTicks(e.duration, TICKS_PER_QUARTER);
                    
                    let timeOffset = 0;
                    if (e.push) timeOffset = -e.push;
                    if (e.pull) timeOffset = e.pull;
                    const actualTime = Math.max(0, voiceTime + timeOffset);
                    
                    if (e.pitch !== 'r') {
                      const midiNote = this.pitchToMidi(e.pitch, e.octave, e.accidental);
                      midiEvents.push({ time: actualTime, type: 'noteOn', note: midiNote, velocity: 80 });
                      midiEvents.push({ time: actualTime + ticks, type: 'noteOff', note: midiNote, velocity: 0 });
                    }
                    voiceTime += ticks;
                  } else if (e.type === 'chord') {
                    const ticks = this.durationToTicks(e.duration, TICKS_PER_QUARTER);
                    
                    let timeOffset = 0;
                    if (e.push) timeOffset = -e.push;
                    if (e.pull) timeOffset = e.pull;
                    const actualTime = Math.max(0, voiceTime + timeOffset);
                    
                    for (const note of e.notes) {
                      if (note.pitch !== 'r') {
                        const midiNote = this.pitchToMidi(note.pitch, note.octave, note.accidental);
                        midiEvents.push({ time: actualTime, type: 'noteOn', note: midiNote, velocity: 80 });
                        midiEvents.push({ time: actualTime + ticks, type: 'noteOff', note: midiNote, velocity: 0 });
                      }
                    }
                    voiceTime += ticks;
                  }
                }
              }
            }
          }
        }
      }
      
      currentTime += TICKS_PER_QUARTER * 4;
    }
    
    midiEvents.sort((a, b) => a.time - b.time);
    
    const bytes: number[] = [];
    let lastTime = 0;
    
    for (const ev of midiEvents) {
      const delta = ev.time - lastTime;
      this.writeVarInt(bytes, delta);
      
      if (ev.type === 'noteOn') {
        bytes.push(0x90 | channel, ev.note!, ev.velocity!);
      } else if (ev.type === 'noteOff') {
        bytes.push(0x80 | channel, ev.note!, ev.velocity!);
      } else if (ev.type === 'pitchBend') {
        const lsb = ev.value! & 0x7F;
        const msb = (ev.value! >> 7) & 0x7F;
        bytes.push(0xE0 | channel, lsb, msb);
      }
      
      lastTime = ev.time;
    }
    
    // End of track
    bytes.push(0x00, 0xFF, 0x2F, 0x00);
    
    return this.buildTrack(bytes);
  }
  
  private durationToTicks(duration: string, ticksPerQuarter: number): number {
    let base = 4;
    let isDotted = false;
    
    if (duration.includes('.')) {
      isDotted = true;
      base = parseInt(duration.split('.')[0], 10);
    } else {
      base = parseInt(duration, 10);
    }
    
    let ticks = (4 / base) * ticksPerQuarter;
    if (isDotted) ticks *= 1.5;
    
    return Math.round(ticks);
  }
  
  private pitchToMidi(pitch: string, octave: number, accidental?: string): number {
    const notes: Record<string, number> = {
      'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
    };
    
    let midi = (octave + 1) * 12 + notes[pitch.toLowerCase()];
    
    if (accidental === '#') midi += 1;
    if (accidental === 'b') midi -= 1;
    // Microtonal + and - are ignored for standard note numbers, handled via pitch bend if implemented
    
    return midi;
  }
  
  private writeVarInt(bytes: number[], value: number) {
    const buffer: number[] = [value & 0x7F];
    while ((value >>= 7)) {
      buffer.push((value & 0x7F) | 0x80);
    }
    for (let i = buffer.length - 1; i >= 0; i--) {
      bytes.push(buffer[i]);
    }
  }
  
  private buildTrack(events: number[]): Uint8Array {
    const track = new Uint8Array(8 + events.length);
    // "MTrk"
    track[0] = 0x4D; track[1] = 0x54; track[2] = 0x72; track[3] = 0x6B;
    // Length
    const len = events.length;
    track[4] = (len >> 24) & 0xFF;
    track[5] = (len >> 16) & 0xFF;
    track[6] = (len >> 8) & 0xFF;
    track[7] = len & 0xFF;
    
    for (let i = 0; i < len; i++) {
      track[8 + i] = events[i];
    }
    
    return track;
  }
  
  private buildMidiFile(tracks: Uint8Array[]): Uint8Array {
    // Header length is 14 bytes
    const totalLength = 14 + tracks.reduce((acc, t) => acc + t.length, 0);
    const midi = new Uint8Array(totalLength);
    
    // "MThd"
    midi[0] = 0x4D; midi[1] = 0x54; midi[2] = 0x68; midi[3] = 0x64;
    // Header length (6)
    midi[4] = 0x00; midi[5] = 0x00; midi[6] = 0x00; midi[7] = 0x06;
    // Format (1 = multitrack)
    midi[8] = 0x00; midi[9] = 0x01;
    // Track count
    midi[10] = (tracks.length >> 8) & 0xFF;
    midi[11] = tracks.length & 0xFF;
    // Division (480 ticks per quarter note)
    midi[12] = 0x01; midi[13] = 0xE0; // 480
    
    let offset = 14;
    for (const track of tracks) {
      midi.set(track, offset);
      offset += track.length;
    }
    
    return midi;
  }
}
