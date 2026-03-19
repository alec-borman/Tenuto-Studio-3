export function registerTenutoLanguage(monaco: any) {
  monaco.languages.register({ id: 'tenuto' });

  monaco.languages.setMonarchTokensProvider('tenuto', {
    keywords: [
      'tenuto', 'meta', 'def', 'measure', 'group', 'style', 'patch', 'v1', 'v2', 'v3', 'v4'
    ],
    tokenizer: {
      root: [
        // Notes (e.g. c4, c#4, c+4)
        [/[a-gA-G][#b+\-^v]*\d+/, 'type'],
        
        // Durations (e.g. :4, :4., :8)
        [/:\d+\.?/, 'number'],
        
        // Identifiers and keywords
        [/[a-zA-Z_]\w*/, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier'
          }
        }],
        
        // Whitespace
        { include: '@whitespace' },
        
        // Strings
        [/"([^"\\]|\\.)*$/, 'string.invalid' ],
        [/"/,  { token: 'string.quote', bracket: '@open', next: '@string' } ],
        
        // Numbers
        [/\d+/, 'number'],
        
        // Delimiters
        [/[{}()\[\]<>|@]/, 'delimiter'],
      ],
      
      string: [
        [/[^\\"]+/,  'string'],
        [/"/,        { token: 'string.quote', bracket: '@close', next: '@pop' } ]
      ],
      
      whitespace: [
        [/[ \t\r\n]+/, 'white'],
        [/\/\/.*$/,    'comment'],
      ],
    }
  });

  monaco.languages.registerHoverProvider('tenuto', {
    provideHover: function (model: any, position: any) {
      const lineContent = model.getLineContent(position.lineNumber);
      const word = model.getWordAtPosition(position);
      
      // Check if inside a chord
      const beforeCursor = lineContent.substring(0, position.column);
      const afterCursor = lineContent.substring(position.column - 1);
      
      const lastOpenBracket = beforeCursor.lastIndexOf('[');
      const firstCloseBracket = afterCursor.indexOf(']');
      
      if (lastOpenBracket !== -1 && firstCloseBracket !== -1) {
        const chordContent = lineContent.substring(lastOpenBracket + 1, position.column - 1 + firstCloseBracket);
        if (/^([a-gA-G][#b+\-^v]*\d+\s*)+$/.test(chordContent.trim())) {
          return {
            range: new monaco.Range(position.lineNumber, lastOpenBracket + 1, position.lineNumber, position.column + firstCloseBracket + 1),
            contents: [
              { value: `**Chord**` },
              { value: `Notes: \`${chordContent.trim()}\`` }
            ]
          };
        }
      }

      if (!word) return null;
      
      // Note hover
      const noteMatch = word.word.match(/^([a-gA-G])([#b+\-^v]*)([0-9]+)$/);
      if (noteMatch) {
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [
            { value: `**Note**: \`${word.word}\`` },
            { value: `Pitch: ${noteMatch[1].toUpperCase()}\nAccidental: ${noteMatch[2] || 'none'}\nOctave: ${noteMatch[3]}` }
          ]
        };
      }
      
      // Keyword hover
      const keywords: Record<string, string> = {
        'tenuto': 'Declares the Tenuto version.',
        'meta': 'Defines metadata for the score or part.',
        'def': 'Defines an instrument or track.',
        'measure': 'Defines a measure of music.'
      };
      
      if (keywords[word.word]) {
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [
            { value: `**Keyword**: \`${word.word}\`` },
            { value: keywords[word.word] }
          ]
        };
      }
      
      return null;
    }
  });
}
