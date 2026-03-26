export function registerTenutoLanguage(monaco: any, manifest?: Record<string, any>) {
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

  monaco.languages.registerCompletionItemProvider('tenuto', {
    triggerCharacters: ['.', '$', '@', ' ', '"', '='],
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);
      
      const suggestions: any[] = [];

      if (textBeforeCursor.endsWith('patch="') || textBeforeCursor.endsWith('src="')) {
        const manifestKeys = manifest && manifest.instruments ? Object.keys(manifest.instruments) : manifest ? Object.keys(manifest) : ['piano', '808_sub', 'vsco_cello'];
        manifestKeys.forEach(key => {
          suggestions.push({
            label: key,
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: key,
            range: range
          });
        });
        return { suggestions };
      }

      // Check if inside a chord
      const lastOpenBracket = textBeforeCursor.lastIndexOf('[');
      const lastCloseBracket = textBeforeCursor.lastIndexOf(']');
      const isInsideChord = lastOpenBracket !== -1 && (lastCloseBracket === -1 || lastCloseBracket < lastOpenBracket);

      if (isInsideChord && !textBeforeCursor.endsWith('.') && !textBeforeCursor.endsWith('$') && !textBeforeCursor.endsWith('@')) {
        // Suggest pitch classes
        const pitches = ['c', 'd', 'e', 'f', 'g', 'a', 'b', 'r'];
        pitches.forEach(p => {
          suggestions.push({
            label: p,
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: p,
            range: range
          });
        });
        return { suggestions };
      }

      if (textBeforeCursor.endsWith('.')) {
        // Attribute chaining
        const attributes = [
          { label: 'stacc', detail: 'Staccato articulation' },
          { label: 'slur', detail: 'Slur to next note' },
          { label: 'glide()', detail: 'Portamento glide', insertText: 'glide(${1:duration})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
          { label: 'f', detail: 'Forte' },
          { label: 'p', detail: 'Piano' },
          { label: 'ff', detail: 'Fortissimo' },
          { label: 'pp', detail: 'Pianissimo' },
          { label: 'cc()', detail: 'Continuous Control', insertText: 'cc(${1:controller}, [${2:start}, ${3:end}], "${4:curve}")', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
          { label: 'crescendo', detail: 'Crescendo' },
          { label: 'diminuendo', detail: 'Diminuendo' },
          { label: 'pan()', detail: 'Pan', insertText: 'pan(${1:value})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
          { label: 'orbit()', detail: 'Spatial orbit', insertText: 'orbit(${1:angle}, ${2:distance})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
          { label: 'fx()', detail: 'Audio effect', insertText: 'fx("${1:type}", ${2:dryWet})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet }
        ];

        attributes.forEach(attr => {
          suggestions.push({
            label: attr.label,
            kind: monaco.languages.CompletionItemKind.Method,
            documentation: attr.detail,
            insertText: attr.insertText || attr.label,
            insertTextRules: attr.insertTextRules,
            range: range
          });
        });
      } else if (textBeforeCursor.endsWith('$')) {
        // Macros
        const text = model.getValue();
        const macroRegex = /macro\s+([a-zA-Z_]\w*)/g;
        let match;
        const macros = new Set<string>();
        while ((match = macroRegex.exec(text)) !== null) {
          macros.add(match[1]);
        }
        
        macros.forEach(m => {
          suggestions.push({
            label: m,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: m,
            range: range
          });
        });
      } else if (textBeforeCursor.endsWith('@')) {
        // SMuFL glyphs or meta
        const glyphs = ['gClef', 'fClef', 'cClef', 'timeSig44', 'timeSig34', 'timeSigCommon'];
        glyphs.forEach(g => {
          suggestions.push({
            label: g,
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: g,
            range: range
          });
        });
      } else {
        // General keywords
        const keywords = ['tenuto', 'meta', 'def', 'measure', 'macro', 'group', 'style', 'patch', 'crescendo', 'diminuendo'];
        keywords.forEach(kw => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range: range
          });
        });
      }

      return { suggestions };
    }
  });
}
