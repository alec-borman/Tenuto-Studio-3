import { describe, it, expect } from 'vitest';
import { EngraverLayout } from './src/engraver/layout';
import { AST } from './src/compiler/parser';

describe('EngraverLayout', () => {
  it('assigns different absolute x coordinates to notes separated by a Major 2nd on the exact same logicalTime', () => {
    const ast: AST = {
      version: '3.0',
      imports: [],
      vars: {},
      meta: {},
      defs: [
        { id: 'p1', name: 'Part 1', style: 'standard', patch: 'gm_piano' }
      ],
      macros: [],
      measures: [
        {
          number: 1,
          parts: [
            {
              id: 'p1',
              voices: [
                {
                  id: 'v1',
                  events: [
                    { type: 'note', pitch: 'c', octave: 4, duration: '4', line: 1, column: 1 }
                  ]
                },
                {
                  id: 'v2',
                  events: [
                    { type: 'note', pitch: 'd', octave: 4, duration: '4', line: 1, column: 1 }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const layout = new EngraverLayout();
    const scoreLayout = layout.layout(ast);
    
    const measure = scoreLayout.pages[0].systems[0].measures[0];
    const v1Events = measure.events.find(e => e.voiceId === 'v1')?.positionedEvents;
    const v2Events = measure.events.find(e => e.voiceId === 'v2')?.positionedEvents;

    expect(v1Events).toBeDefined();
    expect(v2Events).toBeDefined();
    
    if (v1Events && v2Events) {
      expect(v1Events[0].logicalTime).toBe(v2Events[0].logicalTime);
      expect(v1Events[0].x).not.toBe(v2Events[0].x);
    }
  });
});
