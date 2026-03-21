import { describe, it, expect } from 'vitest';
import { registerTenutoLanguage } from './src/editor/tenutoLanguage';

describe('Agentic Editor (LSP Auto-Complete)', () => {
  it('identifies chord context and suggests pitch classes instead of structural keywords', () => {
    let registeredProvider: any = null;
    
    // Mock monaco
    const monaco = {
      languages: {
        register: () => {},
        setMonarchTokensProvider: () => {},
        registerHoverProvider: () => {},
        registerCompletionItemProvider: (languageId: string, provider: any) => {
          registeredProvider = provider;
        },
        CompletionItemKind: {
          Method: 0,
          Variable: 1,
          EnumMember: 2,
          Keyword: 3,
          Value: 4
        },
        CompletionItemInsertTextRule: {
          InsertAsSnippet: 4
        }
      }
    };

    registerTenutoLanguage(monaco);

    expect(registeredProvider).not.toBeNull();

    // Mock model and position
    const model = {
      getWordUntilPosition: () => ({ startColumn: 7, endColumn: 7 }),
      getLineContent: () => '[c4 e ',
      getValue: () => '[c4 e '
    };
    
    const position = {
      lineNumber: 1,
      column: 7
    };

    const completionResult = registeredProvider.provideCompletionItems(model, position);
    
    expect(completionResult).toBeDefined();
    expect(completionResult.suggestions).toBeDefined();
    
    // Should suggest pitch classes
    const labels = completionResult.suggestions.map((s: any) => s.label);
    expect(labels).toContain('c');
    expect(labels).toContain('e');
    expect(labels).toContain('g');
    
    // Should NOT suggest structural keywords
    expect(labels).not.toContain('measure');
    expect(labels).not.toContain('def');
  });
});
