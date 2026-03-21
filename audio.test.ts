import { describe, it, expect } from 'vitest';
import { AudioEventGenerator } from './src/compiler/audio';
import { AST } from './src/compiler/parser';

describe('AudioEngine DSP', () => {
  it('calculates absolute start/stop time delta in seconds based on active BPM for .pan()', () => {
    const ast: AST = {
      version: '3.0',
      imports: [],
      meta: { tempo: '120' },
      defs: [
        { id: 'v1', name: 'Voice 1', style: 'standard', patch: 'gm_piano' }
      ],
      macros: [],
      measures: [
        {
          number: 1,
          parts: [
            {
              id: 'v1',
              voices: [
                {
                  id: '1',
                  events: [
                    {
                      type: 'note',
                      pitch: 'c',
                      octave: 4,
                      duration: '1',
                      modifiers: ['pan([-1.0, 1.0])'],
                      line: 1,
                      column: 1
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const generator = new AudioEventGenerator();
    const events = generator.generate(ast);

    // Find the automation event
    const automationEvent = events.find(e => e.type === 'automation' && e.controller === 'pan');
    
    // Duration of 1 whole note at 120 BPM = 4 beats = 2 seconds
    expect(automationEvent).toBeDefined();
    expect(automationEvent?.duration).toBeCloseTo(2.0);
    expect(automationEvent?.startValue).toBe(-1.0);
    expect(automationEvent?.endValue).toBe(1.0);
  });
});
