import { AST, Event, Note, Chord, Tuplet, MacroCall } from './parser';
import { Diagnostic, CompilerError } from './diagnostics';

export class SemanticError extends CompilerError {
  constructor(message: string, line: number, column: number, suggestion?: string) {
    super({
      status: 'fatal',
      code: 'E2000',
      type: 'Semantic Error',
      location: { line, column },
      diagnostics: {
        message,
        suggestion
      }
    });
    this.name = 'SemanticError';
  }
}

export class SemanticAnalyzer {
  private errors: SemanticError[] = [];
  private macroDurations: Map<string, number> = new Map();

  constructor(private ast: AST) {}

  public analyze(): SemanticError[] {
    this.errors = [];
    this.macroDurations.clear();
    
    // Pre-calculate macro durations
    for (const macro of this.ast.macros) {
        let duration = 0;
        for (const event of macro.events) {
            duration += this.getEventDuration(event);
            this.checkPitches(event);
        }
        this.macroDurations.set(macro.id, duration);
    }
    
    // Check time signature
    let timeSig = this.ast.meta['time'] as string || '4/4';
    const timeMatch = timeSig.match(/^(\d+)\/(\d+)$/);
    if (!timeMatch) {
      this.errors.push(new SemanticError(`Invalid time signature format: ${timeSig}`, 1, 1));
      return this.errors;
    }
    const beatsPerMeasure = parseInt(timeMatch[1], 10);
    const beatUnit = parseInt(timeMatch[2], 10);
    const measureDuration = beatsPerMeasure * (4 / beatUnit); // in quarter notes

    for (const measure of this.ast.measures) {
      for (const part of measure.parts) {
        let partTimeSig = timeSig;
        let partMeasureDuration = measureDuration;
        
        if (part.meta && part.meta['time']) {
          partTimeSig = part.meta['time'] as string;
          const partTimeMatch = partTimeSig.match(/^(\d+)\/(\d+)$/);
          if (partTimeMatch) {
            const pBeats = parseInt(partTimeMatch[1], 10);
            const pUnit = parseInt(partTimeMatch[2], 10);
            partMeasureDuration = pBeats * (4 / pUnit);
          }
        }

        for (const voice of part.voices) {
          let voiceDuration = 0;
          for (const event of voice.events) {
            voiceDuration += this.getEventDuration(event);
            this.checkPitches(event);
          }
          
          // Check if voice duration exceeds measure duration
          // Allow small floating point differences
          if (voiceDuration > partMeasureDuration + 0.001) {
            this.errors.push(new SemanticError(`Impossible rhythm: Voice ${voice.id} duration (${voiceDuration}) exceeds measure duration (${partMeasureDuration}) in part ${part.id}`, measure.number, 1));
          }
        }
      }
    }

    return this.errors;
  }

  private getEventDuration(event: Event): number {
    if (event.type === 'macro_call') {
        if (!this.macroDurations.has(event.id)) {
            this.errors.push(new SemanticError(`Undefined macro: ${event.id}`, event.line, event.column));
            return 0;
        }
        return this.macroDurations.get(event.id)!;
    }
    if (event.modifiers && event.modifiers.includes('grace')) {
      return 0;
    }
    if (event.type === 'note') {
      return this.parseDuration(event.duration, event.line, event.column);
    } else if (event.type === 'chord') {
      return this.parseDuration(event.duration, event.line, event.column);
    } else if (event.type === 'tuplet') {
      let total = 0;
      for (const e of event.events) {
        total += this.getEventDuration(e);
      }
      const ratioParts = event.ratio.split(':');
      if (ratioParts.length === 2) {
        const num = parseInt(ratioParts[0], 10);
        const den = parseInt(ratioParts[1], 10);
        if (num <= 0 || den <= 0) {
          this.errors.push(new SemanticError(`Invalid tuplet ratio: ${event.ratio}`, event.line, event.column));
          return total;
        }
        return total * (den / num);
      }
      return total;
    }
    return 0;
  }

  private parseDuration(durStr: string, line: number, col: number): number {
    let base = 4;
    let dots = 0;
    while (durStr.endsWith('.')) {
      dots++;
      durStr = durStr.slice(0, -1);
    }
    
    if (durStr) {
      base = parseInt(durStr, 10);
      if (isNaN(base) || base <= 0) {
        this.errors.push(new SemanticError(`Invalid duration: ${durStr}`, line, col));
        return 0;
      }
    }
    
    // Duration in quarter notes
    let duration = 4 / base;
    let added = duration / 2;
    for (let i = 0; i < dots; i++) {
      duration += added;
      added /= 2;
    }
    return duration;
  }

  private checkPitches(event: Event) {
    if (event.type === 'macro_call') {
        return; // Pitches already checked during macro definition
    }
    if (event.type === 'note') {
      this.checkNotePitch(event);
    } else if (event.type === 'chord') {
      for (const note of event.notes) {
        this.checkNotePitch(note);
      }
    } else if (event.type === 'tuplet') {
      for (const e of event.events) {
        this.checkPitches(e);
      }
    }
  }

  private checkNotePitch(note: Note) {
    if (note.pitch === 'r') return;
    
    // MIDI range is 0-127
    // C-1 is 0, G9 is 127
    const pitchMap: Record<string, number> = {
      'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
    };
    
    let midi = pitchMap[note.pitch] + (note.octave + 1) * 12;
    
    if (note.accidental) {
      for (const char of note.accidental) {
        if (char === '#') midi += 1;
        else if (char === 'b') midi -= 1;
        else if (char === '+') midi += 0.5; // quarter sharp
        else if (char === '-') midi -= 0.5; // quarter flat
        else if (char === '^') midi += 0.25; // eighth sharp
        else if (char === 'v') midi -= 0.25; // eighth flat
      }
    }
    
    if (midi < 0 || midi > 127) {
      this.errors.push(new SemanticError(`Pitch out of range: ${note.pitch}${note.accidental || ''}${note.octave} (MIDI ${midi})`, note.line, note.column));
    }
  }
}
