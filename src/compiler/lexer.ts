// Hand-rolled Lexer and Parser for Tenuto 3.0

export enum TokenType {
  Identifier = 'Identifier',
  String = 'String',
  Number = 'Number',
  Keyword = 'Keyword',
  Symbol = 'Symbol',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class Lexer {
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(private input: string) {}

  private advance(): string {
    const char = this.input[this.pos++];
    if (char === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return char;
  }

  private peek(): string {
    return this.input[this.pos] || '';
  }

  private skipWhitespace() {
    while (this.pos < this.input.length) {
      const char = this.peek();
      if (/\s/.test(char)) {
        this.advance();
      } else if (char === '/' && this.input[this.pos + 1] === '/') {
        while (this.pos < this.input.length && this.peek() !== '\n') {
          this.advance();
        }
      } else if (char === '%' && this.input[this.pos + 1] === '%') {
        while (this.pos < this.input.length && this.peek() !== '\n') {
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  public nextToken(): Token {
    this.skipWhitespace();

    if (this.pos >= this.input.length) {
      return { type: TokenType.EOF, value: '', line: this.line, column: this.col };
    }

    const startLine = this.line;
    const startCol = this.col;
    const char = this.peek();

    // Symbols
    if (/[{}@=:<\[\]|,\(\)*]/.test(char)) {
      if (char === '|') {
        if (this.peek() === ':') {
          this.advance();
          return { type: TokenType.Symbol, value: '|:', line: startLine, column: startCol };
        }
      } else if (char === ':') {
        if (this.peek() === '|') {
          this.advance();
          return { type: TokenType.Symbol, value: ':|', line: startLine, column: startCol };
        }
      } else if (char === '[') {
        if (/[12]/.test(this.peek()) && this.input[this.pos + 1] === '.') {
          const num = this.advance();
          this.advance(); // '.'
          return { type: TokenType.Symbol, value: `[${num}.`, line: startLine, column: startCol };
        }
      }
      return { type: TokenType.Symbol, value: this.advance(), line: startLine, column: startCol };
    }

    // Strings
    if (char === '"') {
      this.advance(); // skip "
      let value = '';
      while (this.pos < this.input.length && this.peek() !== '"') {
        value += this.advance();
      }
      if (this.peek() === '"') this.advance();
      return { type: TokenType.String, value, line: startLine, column: startCol };
    }

    // Numbers (including fractions like 4/4, and durations like 4. or 4.marc, and units like ms or ticks)
    if (/[0-9]/.test(char)) {
      let value = '';
      while (this.pos < this.input.length && /[0-9./]/.test(this.peek())) {
        value += this.advance();
      }
      // Absorb units like 'ms', 's', 'ticks', '%'
      if (this.peek() === 'm' && this.input[this.pos + 1] === 's') {
        value += this.advance();
        value += this.advance();
      } else if (this.peek() === 's' && !/[a-zA-Z]/.test(this.input[this.pos + 1] || '')) {
        value += this.advance();
      } else if (this.peek() === 't' && this.input.slice(this.pos, this.pos + 5) === 'ticks') {
        for (let i = 0; i < 5; i++) value += this.advance();
      } else if (this.peek() === '%') {
        value += this.advance();
      }
      return { type: TokenType.Number, value, line: startLine, column: startCol };
    }

    // Identifiers and Keywords
    if (/[a-zA-Z_$\+\-#^]/.test(char)) {
      let value = '';
      while (this.pos < this.input.length && /[a-zA-Z0-9_$\+\-#^.]/.test(this.peek())) {
        value += this.advance();
      }
      const keywords = ['tenuto', 'meta', 'def', 'measure', 'group', 'import', 'repeat', 'var'];
      if (keywords.includes(value)) {
        return { type: TokenType.Keyword, value, line: startLine, column: startCol };
      }
      return { type: TokenType.Identifier, value, line: startLine, column: startCol };
    }

    // Fallback
    return { type: TokenType.Symbol, value: this.advance(), line: startLine, column: startCol };
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token = this.nextToken();
    while (token.type !== TokenType.EOF) {
      tokens.push(token);
      token = this.nextToken();
    }
    tokens.push(token);
    return tokens;
  }
}
