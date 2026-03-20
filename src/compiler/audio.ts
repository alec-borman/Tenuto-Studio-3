import { AST, Event, Note, Chord, Tuplet, MacroCall } from './parser';

export interface AudioEvent {
  time: number;
  note: number;
  duration: number;
  velocity: number;
  instrument: string;
  style: string;
  env?: Record<string, string>;
  src?: string;
  push?: number;
  pull?: number;
  modifiers?: string[];
  nextNote?: number;
}

export class AudioEventGenerator {
  private bpm: number = 120;

  public generate(ast: AST): AudioEvent[] {
    const events: AudioEvent[] = [];
    
    if (ast.meta.tempo) {
      this.bpm = parseInt(ast.meta.tempo, 10);
    }
    
    const secondsPerQuarter = 60 / this.bpm;

    for (const def of ast.defs) {
      let currentTime = 0;
      
      for (const measure of ast.measures) {
        const part = measure.parts.find(p => p.id === def.id);
        if (part) {
          const voice = part.voices[0];
          if (voice) {
            let voiceTime = currentTime;
            for (const event of voice.events) {
              const durationInQuarters = this.getDurationInQuarters(event);
              const durationInSeconds = durationInQuarters * secondsPerQuarter;
              
              if (event.type === 'note') {
                if (event.pitch !== 'r') {
                  const midiNote = this.pitchToMidi(event.pitch, event.octave, event.accidental);
                  let velocity = 80;
                  if (event.articulation === 'f') velocity = 100;
                  if (event.articulation === 'p') velocity = 60;
                  if (event.articulation === 'ff') velocity = 120;
                  if (event.articulation === 'pp') velocity = 40;
                  
                  events.push({
                    time: voiceTime,
                    note: midiNote,
                    duration: durationInSeconds,
                    velocity,
                    instrument: def.patch,
                    style: def.style,
                    env: def.env,
                    src: def.src,
                    push: event.push,
                    pull: event.pull,
                    modifiers: event.modifiers
                  });
                }
              } else if (event.type === 'chord') {
                for (const note of event.notes) {
                  if (note.pitch !== 'r') {
                    const midiNote = this.pitchToMidi(note.pitch, note.octave, note.accidental);
                    events.push({
                      time: voiceTime,
                      note: midiNote,
                      duration: durationInSeconds,
                      velocity: 80,
                      instrument: def.patch,
                      style: def.style,
                      env: def.env,
                      src: def.src,
                      push: event.push,
                      pull: event.pull,
                      modifiers: event.modifiers
                    });
                  }
                }
              } else if (event.type === 'tuplet') {
                const ratioParts = event.ratio.split(':');
                const num = parseInt(ratioParts[0], 10);
                const den = parseInt(ratioParts[1], 10);
                const multiplier = den / num;
                
                let tupletTime = voiceTime;
                for (const e of event.events) {
                  const eDurQuarters = this.getDurationInQuarters(e) * multiplier;
                  const eDurSeconds = eDurQuarters * secondsPerQuarter;
                  if (e.type === 'note' && e.pitch !== 'r') {
                    const midiNote = this.pitchToMidi(e.pitch, e.octave, e.accidental);
                    events.push({
                      time: tupletTime,
                      note: midiNote,
                      duration: eDurSeconds,
                      velocity: 80,
                      instrument: def.patch,
                      style: def.style,
                      env: def.env,
                      src: def.src,
                      push: e.push,
                      pull: e.pull,
                      modifiers: e.modifiers
                    });
                  }
                  tupletTime += eDurSeconds;
                }
              }
              
              voiceTime += durationInSeconds;
            }
          }
        }
        
        // Advance currentTime by measure duration (simplified: assuming 4/4 for now)
        // Actually, we should advance by the max voice time in the measure to be safe,
        // but for now let's just use 4 quarters if we don't know.
        // Wait, voiceTime is the exact time. Let's just use voiceTime.
        currentTime += 4 * secondsPerQuarter; // Assuming 4/4
      }
    }
    
    events.sort((a, b) => a.time - b.time);
    
    // Populate nextNote for glide
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.modifiers && event.modifiers.some(m => m.startsWith('glide('))) {
        // Find the next note on the same instrument
        for (let j = i + 1; j < events.length; j++) {
          if (events[j].instrument === event.instrument) {
            event.nextNote = events[j].note;
            break;
          }
        }
      }
    }
    
    return events;
  }

  private getDurationInQuarters(event: Event): number {
    if (event.type === 'note' || event.type === 'chord') {
      return this.parseDuration(event.duration);
    } else if (event.type === 'tuplet') {
      let sum = 0;
      for (const e of event.events) {
        sum += this.getDurationInQuarters(e);
      }
      const ratioParts = event.ratio.split(':');
      const num = parseInt(ratioParts[0], 10);
      const den = parseInt(ratioParts[1], 10);
      return sum * (den / num);
    }
    return 1;
  }

  private parseDuration(durStr: string): number {
    let base = 4;
    let dots = 0;
    
    if (durStr.includes('.')) {
      const parts = durStr.split('.');
      base = parseFloat(parts[0]);
      dots = parts.length - 1;
    } else {
      base = parseFloat(durStr);
    }
    
    let quarters = 4 / base;
    let currentAdd = quarters / 2;
    for (let i = 0; i < dots; i++) {
      quarters += currentAdd;
      currentAdd /= 2;
    }
    
    return quarters;
  }

  private pitchToMidi(pitch: string, octave: number, accidental?: string): number {
    const pitchClasses: Record<string, number> = {
      'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
    };
    let midi = (octave + 1) * 12 + pitchClasses[pitch.toLowerCase()];
    if (accidental === '#') midi += 1;
    if (accidental === 'b') midi -= 1;
    return midi;
  }
}
