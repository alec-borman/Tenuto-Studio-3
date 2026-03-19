import { Lexer, Token, TokenType } from './lexer';

export type AST = {
  version: string;
  meta: Record<string, any>;
  defs: Def[];
  measures: Measure[];
};

export type Def = {
  id: string;
  name: string;
  style: string;
  patch: string;
  group?: string;
};

export type Measure = {
  number: number;
  meta?: Record<string, any>;
  parts: Part[];
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

export type Event = Note | Chord | Tuplet;

export type Note = {
  type: 'note';
  pitch: string;
  octave: number;
  accidental?: string;
  duration: string;
  articulation?: string;
  modifiers?: string[];
  cross?: string;
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

export class ParserError extends Error {
  constructor(public message: string, public line: number, public column: number) {
    super(`[${line}:${column}] ${message}`);
    this.name = 'ParserError';
  }
}

export class Parser {
  private tokens: Token[] = [];
  private pos = 0;

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

  public parse(): AST {
    this.match(TokenType.Keyword, 'tenuto');
    const versionToken = this.match(TokenType.String);
    this.match(TokenType.Symbol, '{');

    const meta: Record<string, any> = {};
    const defs: Def[] = [];
    const measures: Measure[] = [];

    while (!this.check(TokenType.Symbol, '}')) {
      if (this.check(TokenType.Keyword, 'meta')) {
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
      } else if (this.check(TokenType.Keyword, 'group')) {
        this.advance();
        const groupName = this.match(TokenType.String).value;
        this.match(TokenType.Symbol, '{');
        
        while (!this.check(TokenType.Symbol, '}')) {
          if (this.check(TokenType.Keyword, 'def')) {
            this.advance();
            const id = this.match(TokenType.Identifier).value;
            const name = this.match(TokenType.String).value;
            
            let style = 'standard';
            let patch = 'gm_epiano';

            while (this.check(TokenType.Identifier)) {
              const prop = this.advance().value;
              this.match(TokenType.Symbol, '=');
              
              if (this.check(TokenType.Symbol, '@')) {
                this.advance();
                this.match(TokenType.Symbol, '{');
                while (!this.check(TokenType.Symbol, '}')) {
                  const key = this.match(TokenType.Identifier).value;
                  this.match(TokenType.Symbol, ':');
                  const valToken = this.advance();
                  if (key === 'patch') patch = valToken.value;
                  if (key === 'style') style = valToken.value;
                  if (this.check(TokenType.Symbol, ',')) {
                    this.advance();
                  }
                }
                this.match(TokenType.Symbol, '}');
              } else if (this.check(TokenType.Symbol, '[')) {
                this.advance();
                while (!this.check(TokenType.Symbol, ']')) {
                  this.advance();
                }
                this.match(TokenType.Symbol, ']');
              } else {
                const val = this.advance().value;
                if (prop === 'style') style = val;
                if (prop === 'patch') patch = val;
              }
            }

            defs.push({ id, name, style, patch, group: groupName });
          } else {
            const token = this.peek();
            throw new ParserError(`Expected 'def' inside group, got ${token.value}`, token.line, token.column);
          }
        }
        this.match(TokenType.Symbol, '}');
      } else if (this.check(TokenType.Keyword, 'def')) {
        this.advance();
        const id = this.match(TokenType.Identifier).value;
        const name = this.match(TokenType.String).value;
        
        let style = 'standard';
        let patch = 'gm_epiano';

        while (this.check(TokenType.Identifier)) {
          const prop = this.advance().value;
          this.match(TokenType.Symbol, '=');
          
          if (this.check(TokenType.Symbol, '@')) {
            this.advance();
            this.match(TokenType.Symbol, '{');
            while (!this.check(TokenType.Symbol, '}')) {
              const key = this.match(TokenType.Identifier).value;
              this.match(TokenType.Symbol, ':');
              const valToken = this.advance();
              if (key === 'patch') patch = valToken.value;
              if (key === 'style') style = valToken.value;
              if (this.check(TokenType.Symbol, ',')) {
                this.advance();
              }
            }
            this.match(TokenType.Symbol, '}');
          } else if (this.check(TokenType.Symbol, '[')) {
            this.advance();
            while (!this.check(TokenType.Symbol, ']')) {
              this.advance();
            }
            this.match(TokenType.Symbol, ']');
          } else {
            const val = this.advance().value;
            if (prop === 'style') style = val;
            if (prop === 'patch') patch = val;
          }
        }

        defs.push({ id, name, style, patch });
      } else if (this.check(TokenType.Keyword, 'measure')) {
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

        while (!this.check(TokenType.Symbol, '}')) {
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
                
                const events = this.parseEvents(true);
                voices.push({ id: voiceId, events });
                
                if (this.check(TokenType.Symbol, '|')) {
                  this.advance();
                }
              }
              this.match(TokenType.Symbol, ']');
              this.match(TokenType.Symbol, '>');
            } else {
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
        
        for (let i = number; i <= endNumber; i++) {
          const measureParts: Part[] = [];
          for (const p of parsedParts) {
            const mIndex = i - number;
            const voices = p.measureVoices[mIndex] || p.measureVoices[p.measureVoices.length - 1] || [];
            measureParts.push({ id: p.id, meta: p.meta, voices });
          }
          measures.push({ number: i, meta: measureMeta, parts: measureParts });
        }
      } else {
        const token = this.peek();
        throw new ParserError(`Unexpected token ${token.value}`, token.line, token.column);
      }
    }

    this.match(TokenType.Symbol, '}');
    this.match(TokenType.EOF);

    return { version: versionToken.value, meta, defs, measures };
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
      if (this.check(TokenType.Symbol, '[')) {
        events.push(this.parseChord());
      } else if (this.check(TokenType.Symbol, '<')) {
        // Tuplet <[ ... ]>:ratio
        events.push(this.parseTuplet());
      } else if (this.check(TokenType.Symbol, '(')) {
        events.push(this.parseTuplet());
      } else {
        events.push(this.parseNote());
      }
    }
    return events;
  }

  private parseDurationAndModifiers(): { duration: string, articulation?: string, modifiers?: string[], cross?: string } {
    let duration = '4';
    let articulation: string | undefined;
    let modifiers: string[] = [];
    let cross: string | undefined;

    if (this.check(TokenType.Symbol, ':')) {
      this.advance();
      const durToken = this.advance();
      let durStr = durToken.value;

      if (durToken.type === TokenType.Number || durToken.type === TokenType.Identifier) {
        duration = durStr;
        
        let modStr = '';
        if (duration.endsWith('.')) {
          if (this.check(TokenType.Identifier)) {
            modStr = this.advance().value;
          }
        } else if (duration.includes('.')) {
          const parts = duration.split('.');
          duration = parts[0] + '.';
          modStr = parts.slice(1).join('.');
        }

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
            } else if (['marc', 'staccato', 'tenuto', 'slur', 'tie', 'p', 'f', 'mf', 'mp', 'ff', 'pp'].includes(part)) {
              articulation = part;
            } else if (part) {
              modifiers.push(part);
            }
          }
        };

        processModStr(modStr);

        while (this.check(TokenType.Symbol, '.')) {
          this.advance();
          if (this.check(TokenType.Identifier)) {
            processModStr(this.advance().value);
          }
        }
      }
    }

    return { 
      duration, 
      articulation, 
      modifiers: modifiers.length > 0 ? modifiers : undefined, 
      cross 
    };
  }

  private parseNote(): Note {
    const token = this.match(TokenType.Identifier);
    const val = token.value;
    
    let pitch = 'r';
    let accidental: string | undefined;
    let octave = 4;

    if (val !== 'r') {
      const match = val.match(/^([a-gA-G])([#b+\-^v]*)([0-9]+)$/);
      if (!match) {
        throw new ParserError(`Invalid note format: ${val}`, token.line, token.column);
      }
      pitch = match[1].toLowerCase();
      accidental = match[2] || undefined;
      octave = parseInt(match[3], 10);
    }
    
    const { duration, articulation, modifiers, cross } = this.parseDurationAndModifiers();
    
    return { type: 'note', pitch, octave, accidental, duration, articulation, modifiers, cross, line: token.line, column: token.column };
  }

  private parseChord(): Chord {
    const startToken = this.match(TokenType.Symbol, '[');
    const notes: Note[] = [];
    
    while (!this.check(TokenType.Symbol, ']')) {
      const token = this.match(TokenType.Identifier);
      const val = token.value;
      const match = val.match(/^([a-gA-G])([#b+\-^v]*)([0-9]+)$/);
      if (!match) {
        throw new ParserError(`Invalid note format in chord: ${val}`, token.line, token.column);
      }
      notes.push({
        type: 'note',
        pitch: match[1].toLowerCase(),
        octave: parseInt(match[3], 10),
        accidental: match[2] || undefined,
        duration: '',
        line: token.line,
        column: token.column
      });
    }
    this.match(TokenType.Symbol, ']');
    
    const { duration, articulation, modifiers, cross } = this.parseDurationAndModifiers();
    
    return { type: 'chord', notes, duration, articulation, modifiers, cross, line: startToken.line, column: startToken.column };
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
