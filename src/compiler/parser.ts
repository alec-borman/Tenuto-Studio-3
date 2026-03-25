import { Lexer, Token, TokenType } from './lexer';

import { Diagnostic, CompilerError } from './diagnostics';

export type AST = {
  version: string;
  imports: string[];
  vars: Record<string, any>;
  meta: Record<string, any>;
  defs: Def[];
  macros: Macro[];
  measures: Measure[];
};

export type Def = {
  id: string;
  name: string;
  style: string;
  patch: string;
  group?: string;
  env?: Record<string, string>;
  src?: string;
  tuning?: number[];
  map?: Record<string, any>;
};

export type Macro = {
  id: string;
  events: Event[];
};

export type Measure = {
  number: number;
  meta?: Record<string, any>;
  parts: Part[];
  markers?: string[];
};

export type Part = {
  id: string;
  meta?: Record<string, any>;
  voices: Voice[];
};

export type Voice = {
  id: string;
  events: Event[];
};

export type Event = Note | Chord | Tuplet | MacroCall;

export type Note = {
  type: 'note';
  pitch: string;
  octave: number;
  accidental?: string;
  duration: string;
  articulation?: string;
  modifiers?: string[];
  cross?: string;
  lyric?: string;
  push?: number;
  pull?: number;
  line: number;
  column: number;
};

export type Chord = {
  type: 'chord';
  notes: Note[];
  duration: string;
  articulation?: string;
  modifiers?: string[];
  cross?: string;
  lyric?: string;
  push?: number;
  pull?: number;
  line: number;
  column: number;
};

export type Tuplet = {
  type: 'tuplet';
  events: Event[];
  ratio: string;
  modifiers?: string[];
  cross?: string;
  line: number;
  column: number;
};

export type MacroCall = {
  type: 'macro_call';
  id: string;
  transpose?: number;
  line: number;
  column: number;
};

export class ParserError extends CompilerError {
  constructor(message: string, line: number, column: number, suggestion?: string) {
    super({
      status: 'fatal',
      code: 'E1000',
      type: 'Syntax Error',
      location: { line, column },
      diagnostics: {
        message,
        suggestion
      }
    });
    this.name = 'ParserError';
  }
}

interface CachedMeasure {
  measures: Measure[];
  finalOctave: number;
  finalDuration: string;
  finalPitch: string;
  finalStyle: string;
}

const measureCache = new Map<string, CachedMeasure>();

export class Parser {
  private tokens: Token[] = [];
  private pos = 0;
  
  private currentOctave: number = 4;
  private currentDuration: string = '4';
  private currentPitch: string = 'c';
  private currentStyle: string = 'absolute';

  constructor(input: string | Token[]) {
    if (typeof input === 'string') {
      const lexer = new Lexer(input);
      this.tokens = lexer.tokenize();
    } else {
      this.tokens = input;
    }
  }

  private peek(): Token {
    return this.tokens[this.pos] || this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    if (this.pos < this.tokens.length - 1) {
      return this.tokens[this.pos++];
    }
    return this.tokens[this.tokens.length - 1];
  }

  private match(type: TokenType, value?: string): Token {
    const token = this.peek();
    if (token.type === type && (value === undefined || token.value === value)) {
      return this.advance();
    }
    throw new ParserError(`Expected ${type}${value ? ` '${value}'` : ''}, got ${token.type} '${token.value}'`, token.line, token.column);
  }

  private check(type: TokenType, value?: string): boolean {
    const token = this.peek();
    return token.type === type && (value === undefined || token.value === value);
  }

  private parseDef(groupName?: string): Def {
    this.advance(); // consume 'def'
    const id = this.match(TokenType.Identifier).value;
    const name = this.match(TokenType.String).value;
    
    let style = 'standard';
    let patch = 'gm_epiano';
    let env: Record<string, string> | undefined = undefined;
    let src: string | undefined = undefined;
    let tuning: number[] | undefined = undefined;
    let map: Record<string, any> | undefined = undefined;

    while (this.check(TokenType.Identifier)) {
      const prop = this.advance().value;
      this.match(TokenType.Symbol, '=');
      
      if (this.check(TokenType.Symbol, '@')) {
        this.advance();
        this.match(TokenType.Symbol, '{');
        if (prop === 'env') env = {};
        if (prop === 'map') map = {};
        while (!this.check(TokenType.Symbol, '}')) {
          const key = this.match(TokenType.Identifier).value;
          this.match(TokenType.Symbol, ':');
          const val = this.parseMetaValue();
          if (prop === 'env' && env) {
            env[key] = val.toString();
          } else if (prop === 'map' && map) {
            map[key] = val;
          } else {
            if (key === 'patch') patch = val.toString();
            if (key === 'style') style = val.toString();
          }
          if (this.check(TokenType.Symbol, ',')) {
            this.advance();
          }
        }
        this.match(TokenType.Symbol, '}');
      } else if (this.check(TokenType.Symbol, '[')) {
        this.advance();
        if (prop === 'tuning') tuning = [];
        while (!this.check(TokenType.Symbol, ']')) {
          const valToken = this.advance();
          if (prop === 'tuning' && tuning) {
            tuning.push(parseInt(valToken.value, 10));
          }
          if (this.check(TokenType.Symbol, ',')) {
            this.advance();
          }
        }
        this.match(TokenType.Symbol, ']');
      } else {
        const val = this.advance().value;
        if (prop === 'style') style = val;
        if (prop === 'patch') patch = val;
        if (prop === 'src') src = val;
      }
    }

    return { id, name, style, patch, group: groupName, env, src, tuning, map };
  }

  private parseMetaValue(): any {
    const token = this.peek();
    if (token.type === TokenType.String) {
      return this.advance().value;
    } else if (token.type === TokenType.Number) {
      const val = this.advance().value;
      return val.includes('/') ? val : parseFloat(val);
    } else if (token.type === TokenType.Identifier) {
      const val = this.advance().value;
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    } else if (this.check(TokenType.Symbol, '[')) {
      this.advance();
      const arr = [];
      while (!this.check(TokenType.Symbol, ']')) {
        arr.push(this.parseMetaValue());
        if (this.check(TokenType.Symbol, ',')) this.advance();
      }
      this.match(TokenType.Symbol, ']');
      return arr;
    }
    throw new ParserError(`Unexpected meta value token: ${token.value}`, token.line, token.column);
  }

  /**
   * Parses the token stream into an Abstract Syntax Tree (AST).
   * 
   * @returns The generated AST representing the Tenuto source code.
   * @throws {ParserError} If a syntax error is encountered during parsing.
   */
  public parse(): AST {
    measureCache.clear();
    this.match(TokenType.Keyword, 'tenuto');
    const versionToken = this.match(TokenType.String);
    this.match(TokenType.Symbol, '{');

    const imports: string[] = [];
    const vars: Record<string, any> = {};
    const meta: Record<string, any> = {};
    const defs: Def[] = [];
    const macros: Macro[] = [];
    const measures: Measure[] = [];

    while (!this.check(TokenType.Symbol, '}')) {
      if (this.check(TokenType.Keyword, 'import')) {
        this.advance();
        const importPath = this.match(TokenType.String).value;
        imports.push(importPath);
      } else if (this.check(TokenType.Keyword, 'var')) {
        this.advance();
        const varName = this.match(TokenType.Identifier).value;
        this.match(TokenType.Symbol, '=');
        vars[varName] = this.parseMetaValue();
      } else if (this.check(TokenType.Keyword, 'meta')) {
        this.advance();
        this.match(TokenType.Symbol, '@');
        this.match(TokenType.Symbol, '{');
        while (!this.check(TokenType.Symbol, '}')) {
          const key = this.match(TokenType.Identifier).value;
          this.match(TokenType.Symbol, ':');
          meta[key] = this.parseMetaValue();
          if (this.check(TokenType.Symbol, ',')) {
            this.advance();
          }
        }
        this.match(TokenType.Symbol, '}');
      } else if (this.check(TokenType.Identifier) && this.peek().value.startsWith('$')) {
        const idToken = this.advance();
        this.match(TokenType.Symbol, '=');
        this.match(TokenType.Symbol, '{');
        const events = this.parseEvents();
        this.match(TokenType.Symbol, '}');
        macros.push({ id: idToken.value, events });
      } else if (this.check(TokenType.Keyword, 'group')) {
        this.advance();
        const groupName = this.match(TokenType.String).value;
        this.match(TokenType.Symbol, '{');
        
        while (!this.check(TokenType.Symbol, '}')) {
          if (this.check(TokenType.Keyword, 'def')) {
            defs.push(this.parseDef(groupName));
          } else {
            const token = this.peek();
            throw new ParserError(`Expected 'def' inside group, got ${token.value}`, token.line, token.column);
          }
        }
        this.match(TokenType.Symbol, '}');
      } else if (this.check(TokenType.Keyword, 'def')) {
        defs.push(this.parseDef());
      } else if (this.check(TokenType.Keyword, 'measure')) {
        const startPos = this.pos;
        let depth = 0;
        let endPos = this.pos;
        while (endPos < this.tokens.length) {
          if (this.tokens[endPos].value === '{') depth++;
          if (this.tokens[endPos].value === '}') {
            depth--;
            if (depth === 0) {
              endPos++;
              break;
            }
          }
          endPos++;
        }
        
        const measureTokens = this.tokens.slice(startPos, endPos);
        const measureTokensHash = measureTokens.map(t => t.value).join('');
        const stateHash = `${this.currentOctave}-${this.currentDuration}-${this.currentPitch}-${this.currentStyle}`;
        const defsHash = JSON.stringify(defs);
        const fullHash = `${stateHash}-${defsHash}-${measureTokensHash}`;
        
        if (measureCache.has(fullHash)) {
          const cached = measureCache.get(fullHash)!;
          measures.push(...cached.measures);
          this.currentOctave = cached.finalOctave;
          this.currentDuration = cached.finalDuration;
          this.currentPitch = cached.finalPitch;
          this.currentStyle = cached.finalStyle;
          this.pos = endPos;
          continue;
        }

        this.advance();
        const numToken = this.match(TokenType.Number);
        let number = parseInt(numToken.value, 10);
        let endNumber = number;
        
        if (this.check(TokenType.Identifier)) {
          const nextVal = this.peek().value;
          if (nextVal.startsWith('-')) {
            this.advance();
            const slice = nextVal.slice(1);
            if (slice.length > 0) {
              endNumber = parseInt(slice, 10);
            } else {
              endNumber = parseInt(this.match(TokenType.Number).value, 10);
            }
          }
        } else if (this.check(TokenType.Symbol, '-')) {
           this.advance();
           endNumber = parseInt(this.match(TokenType.Number).value, 10);
        }
        this.match(TokenType.Symbol, '{');

        const parsedParts: { id: string, meta?: Record<string, any>, measureVoices: Voice[][] }[] = [];
        let measureMeta: Record<string, any> | undefined = undefined;
        let measureMarkers: string[] = [];

        while (!this.check(TokenType.Symbol, '}')) {
          if (this.check(TokenType.Symbol, '|:')) {
            measureMarkers.push(this.advance().value);
            continue;
          }
          if (this.check(TokenType.Symbol, ':|')) {
            measureMarkers.push(this.advance().value);
            continue;
          }
          if (this.check(TokenType.Symbol, '[1.') || this.check(TokenType.Symbol, '[2.')) {
            measureMarkers.push(this.advance().value);
            continue;
          }

          if (this.check(TokenType.Keyword, 'meta')) {
            this.advance();
            this.match(TokenType.Symbol, '@');
            this.match(TokenType.Symbol, '{');
            measureMeta = {};
            while (!this.check(TokenType.Symbol, '}')) {
              const key = this.match(TokenType.Identifier).value;
              this.match(TokenType.Symbol, ':');
              measureMeta[key] = this.parseMetaValue();
              if (this.check(TokenType.Symbol, ',')) {
                this.advance();
              }
            }
            this.match(TokenType.Symbol, '}');
            continue;
          }

          const partId = this.match(TokenType.Identifier).value;
          this.match(TokenType.Symbol, ':');
          
          let partMeta: Record<string, any> | undefined = undefined;
          if (this.check(TokenType.Keyword, 'meta')) {
            this.advance();
            this.match(TokenType.Symbol, '@');
            this.match(TokenType.Symbol, '{');
            partMeta = {};
            while (!this.check(TokenType.Symbol, '}')) {
              const key = this.match(TokenType.Identifier).value;
              this.match(TokenType.Symbol, ':');
              partMeta[key] = this.parseMetaValue();
              if (this.check(TokenType.Symbol, ',')) {
                this.advance();
              }
            }
            this.match(TokenType.Symbol, '}');
          }
          
          let measureVoices: Voice[][] = [];
          
          while (!this.check(TokenType.Symbol, '}') && !(this.check(TokenType.Identifier) && this.tokens[this.pos + 1]?.value === ':' && defs.some(d => d.id === this.peek().value))) {
            let voices: Voice[] = [];
            
            if (this.check(TokenType.Symbol, '<')) {
              this.advance();
              this.match(TokenType.Symbol, '[');
              
              while (!this.check(TokenType.Symbol, ']')) {
                const voiceId = this.match(TokenType.Identifier).value;
                this.match(TokenType.Symbol, ':');
                
                const partDef = defs.find(d => d.id === partId);
                this.currentStyle = partDef ? partDef.style : 'absolute';
                
                const events = this.parseEvents(true);
                voices.push({ id: voiceId, events });
                
                if (this.check(TokenType.Symbol, '|')) {
                  this.advance();
                }
              }
              this.match(TokenType.Symbol, ']');
              this.match(TokenType.Symbol, '>');
            } else {
              const partDef = defs.find(d => d.id === partId);
              this.currentStyle = partDef ? partDef.style : 'absolute';
              
              const events = this.parseEvents(true);
              voices.push({ id: 'v1', events });
            }
            
            measureVoices.push(voices);
            
            if (this.check(TokenType.Symbol, '|')) {
              this.advance();
            }
          }
          
          parsedParts.push({ id: partId, meta: partMeta, measureVoices });
        }
        this.match(TokenType.Symbol, '}');
        
        const parsedMeasures = [];
        for (let i = number; i <= endNumber; i++) {
          const measureParts: Part[] = [];
          for (const p of parsedParts) {
            const mIndex = i - number;
            const voices = p.measureVoices[mIndex] || p.measureVoices[p.measureVoices.length - 1] || [];
            measureParts.push({ id: p.id, meta: p.meta, voices });
          }
          parsedMeasures.push({ number: i, meta: measureMeta, parts: measureParts, markers: measureMarkers.length > 0 ? measureMarkers : undefined });
        }
        measures.push(...parsedMeasures);
        
        measureCache.set(fullHash, {
          measures: parsedMeasures,
          finalOctave: this.currentOctave,
          finalDuration: this.currentDuration,
          finalPitch: this.currentPitch,
          finalStyle: this.currentStyle
        });
      } else {
        const token = this.peek();
        throw new ParserError(`Unexpected token ${token.value}`, token.line, token.column);
      }
    }

    this.match(TokenType.Symbol, '}');
    this.match(TokenType.EOF);

    return { version: versionToken.value, imports, vars, meta, defs, macros, measures };
  }

  private parseEvents(stopAtBarline: boolean = false): Event[] {
    const events: Event[] = [];
    while (
      (!stopAtBarline || !this.check(TokenType.Symbol, '|')) && 
      !this.check(TokenType.Symbol, ']') && 
      !this.check(TokenType.Symbol, '}') &&
      !this.check(TokenType.Symbol, ')')
    ) {
      if (this.check(TokenType.Symbol, '|')) {
        this.advance(); // consume the barline if we're not stopping at it
        continue;
      }
      if (this.check(TokenType.Keyword, 'repeat')) {
        this.advance();
        const count = parseInt(this.match(TokenType.Number).value, 10);
        this.match(TokenType.Symbol, '{');
        const repeatedEvents = this.parseEvents();
        this.match(TokenType.Symbol, '}');
        for (let i = 0; i < count; i++) {
          events.push(...JSON.parse(JSON.stringify(repeatedEvents)));
        }
        continue;
      }
      if (this.check(TokenType.Identifier) && this.peek().value.startsWith('$')) {
        const idToken = this.advance();
        let transpose = 0;
        if (this.check(TokenType.Symbol, '+') || this.check(TokenType.Symbol, '-')) {
            const sign = this.advance().value;
            const numToken = this.match(TokenType.Number);
            transpose = parseInt(numToken.value, 10) * (sign === '-' ? -1 : 1);
            if (this.check(TokenType.Identifier) && this.peek().value === 'st') {
                this.advance();
            }
        }
        events.push({
            type: 'macro_call',
            id: idToken.value,
            transpose,
            line: idToken.line,
            column: idToken.column
        });
      } else if (this.check(TokenType.Symbol, '[')) {
        events.push(this.parseChord());
      } else if (this.check(TokenType.Symbol, '<')) {
        // Tuplet <[ ... ]>:ratio
        events.push(this.parseTuplet());
      } else if (this.check(TokenType.Symbol, '(')) {
        events.push(this.parseTuplet());
      } else if (this.check(TokenType.Identifier)) {
        if (this.tokens[this.pos + 1]?.value === '(') {
          events.push(...this.parseEuclidean());
        } else {
          events.push(this.parseNote());
        }
      } else {
        events.push(this.parseNote());
      }
    }
    return events;
  }

  private parseEuclidean(): Note[] {
    let token = this.peek();
    let val = '';
    
    if (token.type === TokenType.Number) {
      val = this.advance().value;
      if (this.check(TokenType.Symbol, '-')) {
        val += this.advance().value;
        if (this.check(TokenType.Number)) {
          val += this.advance().value;
        }
      } else if (this.check(TokenType.Identifier) && this.peek().value.startsWith('-')) {
        val += this.advance().value;
      }
    } else {
      token = this.match(TokenType.Identifier);
      val = token.value;
    }
    
    let pitch = 'r';
    let accidental: string | undefined;
    let octave = this.currentOctave;

    if (val !== 'r') {
      if (this.currentStyle === 'tab' || this.currentStyle === 'grid') {
        pitch = val;
      } else {
        const match = val.match(/^([a-gA-G])([#b+\-^v]*)([0-9]*)$/);
        if (!match) {
          throw new ParserError(`Invalid note format: ${val}`, token.line, token.column);
        }
        pitch = match[1].toLowerCase();
        accidental = match[2] || undefined;
        
        if (match[3]) {
          octave = parseInt(match[3], 10);
        } else if (this.currentStyle === 'relative') {
          octave = this.calculateRelativeOctave(pitch);
        }
        
        this.currentOctave = octave;
        this.currentPitch = pitch;
      }
    }

    this.match(TokenType.Symbol, '(');
    const hits = parseInt(this.match(TokenType.Number).value, 10);
    this.match(TokenType.Symbol, ',');
    const steps = parseInt(this.match(TokenType.Number).value, 10);
    this.match(TokenType.Symbol, ')');

    const { duration, articulation, modifiers, cross, push, pull } = this.parseDurationAndModifiers();

    const notes: Note[] = [];
    for (let i = 0; i < steps; i++) {
      // Bresenham / Euclidean rhythm logic
      const isHit = (i * hits) % steps < hits;
      
      if (isHit) {
        notes.push({
          type: 'note',
          pitch,
          octave,
          accidental,
          duration,
          articulation,
          modifiers,
          cross,
          push,
          pull,
          line: token.line,
          column: token.column
        });
      } else {
        notes.push({
          type: 'note',
          pitch: 'r',
          octave,
          duration,
          line: token.line,
          column: token.column
        });
      }
    }

    return notes;
  }

  private parseDurationAndModifiers(): { duration: string, articulation?: string, modifiers?: string[], cross?: string, push?: number, pull?: number } {
    let duration = this.currentDuration;
    let articulation: string | undefined;
    let modifiers: string[] = [];
    let cross: string | undefined;
    let push: number | undefined;
    let pull: number | undefined;

    const processModStr = (str: string) => {
      if (!str) return;
      const parts = str.split('.');
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === 'cross') {
          if (this.check(TokenType.Symbol, '(')) {
            this.advance();
            cross = this.match(TokenType.Identifier).value;
            this.match(TokenType.Symbol, ')');
          }
        } else if (part === 'push') {
          if (this.check(TokenType.Symbol, '(')) {
            this.advance();
            push = parseInt(this.match(TokenType.Number).value, 10);
            this.match(TokenType.Symbol, ')');
          }
        } else if (part === 'pull') {
          if (this.check(TokenType.Symbol, '(')) {
            this.advance();
            pull = parseInt(this.match(TokenType.Number).value, 10);
            this.match(TokenType.Symbol, ')');
          }
        } else if (['slice', 'pan', 'orbit', 'fx', 'glide', 'cc', 'bu', 'bd'].includes(part)) {
          if (this.check(TokenType.Symbol, '(')) {
            this.advance();
            let args = '';
            while (!this.check(TokenType.Symbol, ')') && !this.check(TokenType.EOF)) {
              const token = this.advance();
              if (token.type === TokenType.String) {
                args += `"${token.value}"`;
              } else {
                args += token.value;
              }
            }
            modifiers.push(`${part}(${args})`);
            this.match(TokenType.Symbol, ')');
          }
        } else if (part === 'crescendo') {
          modifiers.push('crescendo');
        } else if (part === 'diminuendo') {
          modifiers.push('diminuendo');
        } else if (['stacc', 'ten', 'marc', 'slur', 'f', 'p', 'ff', 'pp', 'sfz'].includes(part)) {
          articulation = part;
          modifiers.push(part); // FIX: Ensure SVG Engraver receives stacking data
        } else if (part) {
          modifiers.push(part);
        }
      }
    };

    if (this.check(TokenType.Symbol, ':')) {
      this.advance();
      const durToken = this.advance();
      let durStr = durToken.value;

      if (durToken.type === TokenType.Number || durToken.type === TokenType.Identifier) {
        duration = durStr;
        
        let modStr = '';
        if (duration.endsWith('.')) {
          if (this.check(TokenType.Identifier)) {
            const nextToken = this.peek();
            // ONLY absorb the modifier if it physically touches the dot (no spaces/newlines)
            if (durToken.line === nextToken.line && (durToken.column + durToken.value.length) === nextToken.column) {
              // If the user wrote 4..stacc, it's a dotted duration with a modifier.
              // If they wrote 4.stacc, it's a regular duration with a modifier.
              if (duration.endsWith('..')) {
                duration = duration.slice(0, -1); // Keep one dot for dotted duration
              } else {
                duration = duration.slice(0, -1); // Strip the accessor dot
              }
              modStr = this.advance().value;
            }
          }
        } else if (duration.includes('.')) {
          const parts = duration.split('.');
          if (isNaN(parseFloat(duration))) {
             duration = parts[0] + '.';
             modStr = parts.slice(1).join('.');
          }
        }

        this.currentDuration = duration;
        processModStr(modStr);
      }
    }

    while (this.check(TokenType.Symbol, '.')) {
      this.advance();
      if (this.check(TokenType.Identifier)) {
        processModStr(this.advance().value);
      }
    }

    return { 
      duration, 
      articulation, 
      modifiers: modifiers.length > 0 ? modifiers : undefined, 
      cross,
      push,
      pull
    };
  }

  private calculateRelativeOctave(pitch: string): number {
    const pitchClasses: Record<string, number> = { 'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11 };
    const currentMidi = this.currentOctave * 12 + pitchClasses[this.currentPitch];
    const newPitchClass = pitchClasses[pitch];
    
    let bestOctave = this.currentOctave;
    let minDistance = Infinity;
    
    for (let oct = this.currentOctave - 1; oct <= this.currentOctave + 1; oct++) {
      const midi = oct * 12 + newPitchClass;
      const dist = Math.abs(midi - currentMidi);
      if (dist < minDistance) {
        minDistance = dist;
        bestOctave = oct;
      }
    }
    return bestOctave;
  }

  private parseNote(): Note {
    let token = this.peek();
    let val = '';
    
    if (token.type === TokenType.Number) {
      val = this.advance().value;
      if (this.check(TokenType.Symbol, '-')) {
        val += this.advance().value;
        if (this.check(TokenType.Number)) {
          val += this.advance().value;
        }
      } else if (this.check(TokenType.Identifier) && this.peek().value.startsWith('-')) {
        val += this.advance().value;
      }
    } else {
      token = this.match(TokenType.Identifier);
      val = token.value;
    }
    
    let hasUnderscore = false;
    if (val.endsWith('_')) {
      val = val.slice(0, -1);
      hasUnderscore = true;
    }
    
    let pitch = 'r';
    let accidental: string | undefined;
    let octave = this.currentOctave;

    if (val !== 'r') {
      if (this.currentStyle === 'tab' || this.currentStyle === 'grid' || this.currentStyle === 'concrete') {
        pitch = val;
      } else {
        const match = val.match(/^([a-gA-G])([#b+\-^v]*)([0-9]*)$/);
        if (!match) {
          throw new ParserError(`Invalid note format: ${val}`, token.line, token.column);
        }
        pitch = match[1].toLowerCase();
        accidental = match[2] || undefined;
        
        if (match[3]) {
          octave = parseInt(match[3], 10);
        } else if (this.currentStyle === 'relative') {
          octave = this.calculateRelativeOctave(pitch);
        }
        
        this.currentOctave = octave;
        this.currentPitch = pitch;
      }
    }
    
    const { duration, articulation, modifiers, cross, push, pull } = this.parseDurationAndModifiers();
    
    let lyric: string | undefined;
    if (hasUnderscore || this.check(TokenType.Identifier, '_')) {
      if (!hasUnderscore) this.advance();
    }
    if (this.check(TokenType.String)) {
      lyric = this.advance().value;
    }
    
    return { type: 'note', pitch, octave, accidental, duration, articulation, modifiers, cross, lyric, push, pull, line: token.line, column: token.column };
  }

  private parseChord(): Chord {
    const startToken = this.match(TokenType.Symbol, '[');
    const notes: Note[] = [];
    
    while (!this.check(TokenType.Symbol, ']')) {
      let token = this.peek();
      let val = '';
      
      if (token.type === TokenType.Number) {
        val = this.advance().value;
        if (this.check(TokenType.Symbol, '-')) {
          val += this.advance().value;
          if (this.check(TokenType.Number)) {
            val += this.advance().value;
          }
        } else if (this.check(TokenType.Identifier) && this.peek().value.startsWith('-')) {
          val += this.advance().value;
        }
      } else {
        token = this.match(TokenType.Identifier);
        val = token.value;
      }
      
      let pitch = 'r';
      let accidental: string | undefined;
      let octave = this.currentOctave;

      if (val !== 'r') {
        if (this.currentStyle === 'tab' || this.currentStyle === 'grid' || this.currentStyle === 'concrete') {
          pitch = val;
        } else {
          const match = val.match(/^([a-gA-G])([#b+\-^v]*)([0-9]*)$/);
          if (!match) {
            throw new ParserError(`Invalid note format in chord: ${val}`, token.line, token.column);
          }
          
          pitch = match[1].toLowerCase();
          
          if (match[3]) {
            octave = parseInt(match[3], 10);
          } else if (this.currentStyle === 'relative') {
            octave = this.calculateRelativeOctave(pitch);
          }
          
          this.currentOctave = octave;
          this.currentPitch = pitch;
          accidental = match[2] || undefined;
        }
      }
      
      notes.push({
        type: 'note',
        pitch,
        octave,
        accidental,
        duration: '',
        line: token.line,
        column: token.column
      });
    }
    this.match(TokenType.Symbol, ']');
    
    const { duration, articulation, modifiers, cross, push, pull } = this.parseDurationAndModifiers();
    
    let lyric: string | undefined;
    if (this.check(TokenType.Identifier, '_')) {
      this.advance();
    }
    if (this.check(TokenType.String)) {
      lyric = this.advance().value;
    }
    
    return { type: 'chord', notes, duration, articulation, modifiers, cross, lyric, push, pull, line: startToken.line, column: startToken.column };
  }

  private parseTuplet(): Tuplet {
    let startToken: Token;
    let isAngleBracket = false;

    if (this.check(TokenType.Symbol, '<')) {
      startToken = this.match(TokenType.Symbol, '<');
      this.match(TokenType.Symbol, '[');
      isAngleBracket = true;
    } else {
      startToken = this.match(TokenType.Symbol, '(');
    }
    
    const events = this.parseEvents();
    
    if (isAngleBracket) {
      this.match(TokenType.Symbol, ']');
      this.match(TokenType.Symbol, '>');
    } else {
      this.match(TokenType.Symbol, ')');
    }
    
    let ratio = '3/2';
    let modifiers: string[] = [];
    let cross: string | undefined;

    if (this.check(TokenType.Symbol, ':')) {
      this.advance();
      ratio = this.match(TokenType.Number).value;
      
      const processModStr = (str: string) => {
        if (!str) return;
        const parts = str.split('.');
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part === 'cross') {
            if (this.check(TokenType.Symbol, '(')) {
              this.advance();
              cross = this.match(TokenType.Identifier).value;
              this.match(TokenType.Symbol, ')');
            }
          } else if (part) {
            modifiers.push(part);
          }
        }
      };

      if (ratio.includes('.')) {
        const parts = ratio.split('.');
        ratio = parts[0];
        processModStr(parts.slice(1).join('.'));
      }

      while (this.check(TokenType.Symbol, '.')) {
        this.advance();
        if (this.check(TokenType.Identifier)) {
          processModStr(this.advance().value);
        }
      }
    }
    
    return { 
      type: 'tuplet', 
      events, 
      ratio, 
      modifiers: modifiers.length > 0 ? modifiers : undefined,
      cross,
      line: startToken.line, 
      column: startToken.column 
    };
  }
}
