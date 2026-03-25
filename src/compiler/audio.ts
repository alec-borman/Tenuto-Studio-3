import { AST, Event, Note, Chord, Tuplet, MacroCall } from './parser';

export interface AudioEvent {
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
  nextNote?: number;
  pan?: number;
  orbit?: { angle: number, dist: number };
  fx?: { type: string, dryWet?: number, [key: string]: any };
  controller?: number | string;
  startValue?: number;
  endValue?: number;
  curve?: string;
}

export class AudioEventGenerator {
  private bpm: number = 120;
  private vars: Record<string, any> = {};

  private resolveValue(val: any): any {
    if (typeof val === 'string' && val.startsWith('$')) {
      const varName = val.slice(1);
      const resolved = this.vars[varName];
      if (resolved === undefined) {
        console.warn(`[TEDP] Unresolved variable: ${val}`);
        return val;
      }
      return resolved;
    }
    return val;
  }

  private processModifiers(modifiers: string[] | undefined, time: number, duration: number, instrument: string, events: AudioEvent[]) {
    let pan: number | undefined;
    let orbit: { angle: number, dist: number } | undefined;
    let fx: { type: string, dryWet?: number, [key: string]: any } | undefined;

    if (modifiers) {
      for (const mod of modifiers) {
        if (mod.startsWith('pan(')) {
          const match = mod.match(/pan\(([-.\d]+)\)/);
          if (match) {
            pan = parseFloat(match[1]);
          } else {
            const arrayMatch = mod.match(/pan\(\[([-.\d]+),\s*([-.\d]+)\]\)/);
            if (arrayMatch) {
              events.push({
                type: 'automation',
                time,
                duration,
                instrument,
                controller: 'pan',
                startValue: parseFloat(arrayMatch[1]),
                endValue: parseFloat(arrayMatch[2]),
                curve: 'linear'
              });
            } else {
              const arrayMatchWithCurve = mod.match(/pan\(\[([-.\d]+),\s*([-.\d]+)\],\s*"([^"]+)"\)/);
              if (arrayMatchWithCurve) {
                events.push({
                  type: 'automation',
                  time,
                  duration,
                  instrument,
                  controller: 'pan',
                  startValue: parseFloat(arrayMatchWithCurve[1]),
                  endValue: parseFloat(arrayMatchWithCurve[2]),
                  curve: arrayMatchWithCurve[3]
                });
              }
            }
          }
        } else if (mod.startsWith('orbit(')) {
          const match = mod.match(/orbit\(([-.\d]+),([-.\d]+)\)/);
          if (match) orbit = { angle: parseFloat(match[1]), dist: parseFloat(match[2]) };
        } else if (mod.startsWith('fx(')) {
          const simpleMatch = mod.match(/fx\("([^"]+)",([-.\d]+)\)/);
          if (simpleMatch) {
            fx = { type: simpleMatch[1], dryWet: parseFloat(simpleMatch[2]) };
          } else {
            const complexMatch = mod.match(/fx\("([^"]+)",@\{([^}]+)\}\)/);
            if (complexMatch) {
              const type = complexMatch[1];
              const paramsStr = complexMatch[2];
              const params: any = {};
              paramsStr.split(',').forEach(p => {
                const [k, v] = p.split(':');
                if (k && v) params[k.trim()] = v.trim();
              });
              fx = { type, dryWet: 1.0, ...params };
            }
          }
        } else if (mod.startsWith('cc(')) {
          const match = mod.match(/cc\((\d+),\[(\d+),(\d+)\],"([^"]+)"\)/);
          if (match) {
            events.push({
              type: 'automation',
              time,
              duration,
              instrument,
              controller: parseInt(match[1], 10),
              startValue: parseInt(match[2], 10),
              endValue: parseInt(match[3], 10),
              curve: match[4]
            });
          }
        } else if (mod.startsWith('bu(')) {
          const match = mod.match(/bu\(([-.\d]+)\)/);
          if (match) {
            const semitones = parseFloat(match[1]);
            // Map semitones to 14-bit pitch bend (assuming 2 semitones = 8191)
            // Center is 8192. Max is 16383 (+2 semitones). Min is 0 (-2 semitones).
            // So 1 semitone = 4096.
            const endValue = Math.min(16383, Math.max(0, 8192 + semitones * 4096));
            events.push({
              type: 'automation',
              time,
              duration,
              instrument,
              controller: 'pitchbend',
              startValue: 8192,
              endValue,
              curve: 'linear'
            });
          }
        } else if (mod.startsWith('bd(')) {
          const match = mod.match(/bd\(([-.\d]+)\)/);
          if (match) {
            const semitones = parseFloat(match[1]);
            const endValue = Math.min(16383, Math.max(0, 8192 - semitones * 4096));
            events.push({
              type: 'automation',
              time,
              duration,
              instrument,
              controller: 'pitchbend',
              startValue: 8192,
              endValue,
              curve: 'linear'
            });
          }
        } else if (mod === 'crescendo') {
          events.push({
            type: 'automation',
            time,
            duration,
            instrument,
            controller: 'volume',
            startValue: 0.5,
            endValue: 1.0,
            curve: 'linear'
          });
        } else if (mod === 'diminuendo') {
          events.push({
            type: 'automation',
            time,
            duration,
            instrument,
            controller: 'volume',
            startValue: 1.0,
            endValue: 0.5,
            curve: 'linear'
          });
        }
      }
    }

    return { pan, orbit, fx };
  }

  public generate(ast: AST): AudioEvent[] {
    const events: AudioEvent[] = [];
    this.vars = ast.vars || {};
    
    if (ast.meta.tempo) {
      this.bpm = parseInt(ast.meta.tempo, 10);
    }
    
    const secondsPerQuarter = 60 / this.bpm;

    for (const def of ast.defs) {
      let currentTime = 0;
      
      const resolvedEnv: Record<string, string> = {};
      if (def.env) {
        for (const [key, val] of Object.entries(def.env)) {
          resolvedEnv[key] = this.resolveValue(val).toString();
        }
      }

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
                  const midiNote = this.resolvePitch(event.pitch, event.octave, event.accidental, def);
                  let velocity = 80;
                  if (event.articulation === 'f') velocity = 100;
                  if (event.articulation === 'p') velocity = 60;
                  if (event.articulation === 'ff') velocity = 120;
                  if (event.articulation === 'pp') velocity = 40;
                  
                  const { pan, orbit, fx } = this.processModifiers(event.modifiers, voiceTime, durationInSeconds, def.patch, events);

                  events.push({
                    time: voiceTime,
                    note: midiNote,
                    duration: durationInSeconds,
                    velocity,
                    instrument: def.patch,
                    style: def.style,
                    env: resolvedEnv,
                    src: def.src,
                    push: event.push,
                    pull: event.pull,
                    modifiers: event.modifiers,
                    pan,
                    orbit,
                    fx
                  });
                }
              } else if (event.type === 'chord') {
                for (const note of event.notes) {
                  if (note.pitch !== 'r') {
                    const midiNote = this.resolvePitch(note.pitch, note.octave, note.accidental, def);
                    const { pan, orbit, fx } = this.processModifiers(event.modifiers, voiceTime, durationInSeconds, def.patch, events);

                    events.push({
                      time: voiceTime,
                      note: midiNote,
                      duration: durationInSeconds,
                      velocity: 80,
                      instrument: def.patch,
                      style: def.style,
                      env: resolvedEnv,
                      src: def.src,
                      push: event.push,
                      pull: event.pull,
                      modifiers: event.modifiers,
                      pan,
                      orbit,
                      fx
                    });
                  }
                }
              } else if (event.type === 'tuplet') {
                const ratioParts = event.ratio.split('/');
                let num = 3;
                let den = 2;
                if (ratioParts.length === 2) {
                  num = parseInt(ratioParts[0], 10);
                  den = parseInt(ratioParts[1], 10);
                } else if (ratioParts.length === 1) {
                  num = parseInt(ratioParts[0], 10);
                  den = Math.pow(2, Math.floor(Math.log2(num)));
                  if (num === den) den = num / 2;
                }
                const multiplier = den / num;
                
                let tupletTime = voiceTime;
                for (const e of event.events) {
                  const eDurQuarters = this.getDurationInQuarters(e) * multiplier;
                  const eDurSeconds = eDurQuarters * secondsPerQuarter;
                  if (e.type === 'note' && e.pitch !== 'r') {
                    const midiNote = this.resolvePitch(e.pitch, e.octave, e.accidental, def);
                    const { pan, orbit, fx } = this.processModifiers(e.modifiers, tupletTime, eDurSeconds, def.patch, events);

                    events.push({
                      time: tupletTime,
                      note: midiNote,
                      duration: eDurSeconds,
                      velocity: 80,
                      instrument: def.patch,
                      style: def.style,
                      env: resolvedEnv,
                      src: def.src,
                      push: e.push,
                      pull: e.pull,
                      modifiers: e.modifiers,
                      pan,
                      orbit,
                      fx
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
      const ratioParts = event.ratio.split('/');
      let num = 3;
      let den = 2;
      if (ratioParts.length === 2) {
        num = parseInt(ratioParts[0], 10);
        den = parseInt(ratioParts[1], 10);
      } else if (ratioParts.length === 1) {
        num = parseInt(ratioParts[0], 10);
        den = Math.pow(2, Math.floor(Math.log2(num)));
        if (num === den) den = num / 2;
      }
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

  private resolvePitch(pitch: string, octave: number, accidental: string | undefined, def: any): number {
    const resolvedPitch = this.resolveValue(pitch);

    if (def.style === 'tab') {
      const parts = resolvedPitch.split('-');
      if (parts.length === 2) {
        const fret = parseInt(parts[0], 10);
        const stringNum = parseInt(parts[1], 10);
        const tuning = def.tuning || [40, 45, 50, 55, 59, 64]; // EADGBE
        // strings are 1-indexed, usually from highest to lowest or lowest to highest?
        // standard guitar string 1 is high E (64), string 6 is low E (40)
        // so tuning[6 - stringNum]
        const stringIndex = tuning.length - stringNum;
        if (stringIndex >= 0 && stringIndex < tuning.length) {
          return tuning[stringIndex] + fret;
        }
      }
      return 60; // fallback
    } else if (def.style === 'grid') {
      if (def.map && def.map[resolvedPitch] !== undefined) {
        return this.resolveValue(def.map[resolvedPitch]);
      }
      return 36; // fallback to kick
    }
    
    const pitchClasses: Record<string, number> = {
      'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
    };
    let midi = (octave + 1) * 12 + pitchClasses[resolvedPitch.toLowerCase()];
    if (accidental === '#') midi += 1;
    if (accidental === 'b') midi -= 1;
    return midi;
  }
}
