import { AST, Chord, Event, Measure, Note, Part, Voice } from './parser';
import { Diagnostic, CompilerError } from './diagnostics';

export interface LinterPlugin {
  name: string;
  checkChord?: (chord: Chord, ctx: LinterContext) => void;
  checkNote?: (note: Note, ctx: LinterContext) => void;
}

export interface LinterContext {
  report: (diagnostic: Diagnostic) => void;
}

export class Linter {
  private plugins: LinterPlugin[] = [];
  private diagnostics: Diagnostic[] = [];

  constructor() {
    this.registerPlugin(new MudZoneRule());
    this.registerPlugin(new ErgonomicHandSpanRule());
  }

  public registerPlugin(plugin: LinterPlugin) {
    this.plugins.push(plugin);
  }

  public lint(ast: AST): Diagnostic[] {
    this.diagnostics = [];
    const ctx: LinterContext = {
      report: (diagnostic) => this.diagnostics.push(diagnostic)
    };

    for (const measure of ast.measures) {
      for (const part of measure.parts) {
        for (const voice of part.voices) {
          for (const event of voice.events) {
            this.checkEvent(event, ctx);
          }
        }
      }
    }

    for (const macro of ast.macros) {
      for (const event of macro.events) {
        this.checkEvent(event, ctx);
      }
    }

    return this.diagnostics;
  }

  private checkEvent(event: Event, ctx: LinterContext) {
    if (event.type === 'chord') {
      for (const plugin of this.plugins) {
        if (plugin.checkChord) {
          plugin.checkChord(event, ctx);
        }
      }
    } else if (event.type === 'note') {
      for (const plugin of this.plugins) {
        if (plugin.checkNote) {
          plugin.checkNote(event, ctx);
        }
      }
    } else if (event.type === 'tuplet') {
      for (const e of event.events) {
        this.checkEvent(e, ctx);
      }
    }
  }
}

function pitchToMidi(pitch: string, octave: number, accidental?: string): number {
  const pitchClasses: Record<string, number> = { 'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11 };
  let midi = (octave + 1) * 12 + pitchClasses[pitch.toLowerCase()];
  if (accidental === '#') midi += 1;
  if (accidental === 'b') midi -= 1;
  return midi;
}

class MudZoneRule implements LinterPlugin {
  name = 'MudZoneRule';

  checkChord(chord: Chord, ctx: LinterContext) {
    const midiNotes = chord.notes
      .filter(n => n.pitch !== 'r')
      .map(n => pitchToMidi(n.pitch, n.octave, n.accidental))
      .sort((a, b) => a - b);

    for (let i = 0; i < midiNotes.length - 1; i++) {
      const n1 = midiNotes[i];
      const n2 = midiNotes[i + 1];
      if (n1 < 48 && n2 < 48) { // Below C3
        const interval = n2 - n1;
        if (interval <= 4) { // Major third or smaller
          ctx.report({
            status: 'warning',
            code: 'W3001',
            type: 'Mud Zone',
            location: { line: chord.line, column: chord.column },
            diagnostics: {
              message: 'Dense intervals (thirds or seconds) below C3 can sound muddy.',
              suggestion: 'Consider using open fifths or octaves in the lower register.'
            }
          });
          return; // Only report once per chord
        }
      }
    }
  }
}

class ErgonomicHandSpanRule implements LinterPlugin {
  name = 'ErgonomicHandSpanRule';

  checkChord(chord: Chord, ctx: LinterContext) {
    const midiNotes = chord.notes
      .filter(n => n.pitch !== 'r')
      .map(n => pitchToMidi(n.pitch, n.octave, n.accidental))
      .sort((a, b) => a - b);

    if (midiNotes.length >= 2) {
      const lowest = midiNotes[0];
      const highest = midiNotes[midiNotes.length - 1];
      const span = highest - lowest;
      
      if (span >= 16) { // Major 10th (16 semitones) or greater
        ctx.report({
          status: 'warning',
          code: 'W3002',
          type: 'Ergonomic Hand-Span',
          location: { line: chord.line, column: chord.column },
          diagnostics: {
            message: 'Chord span is a 10th or greater, which is physically unplayable by a standard human pianist.',
            suggestion: 'Consider rolling the chord, dropping notes, or splitting it across multiple hands/voices.'
          }
        });
      }
    }
  }
}
