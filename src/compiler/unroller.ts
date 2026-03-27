import { AST, Measure, Event, Voice, Part } from './parser';

export class GraphUnroller {
  private ast: AST;

  constructor(ast: AST) {
    this.ast = ast;
  }

  public unroll(): AST {
    const measures = this.ast.measures;
    const startRepeat: boolean[] = new Array(measures.length).fill(false);
    const endRepeat: boolean[] = new Array(measures.length).fill(false);
    const volta: (number | undefined)[] = new Array(measures.length).fill(undefined);

    // Pass 1: Analyze structural markers
    for (let i = 0; i < measures.length; i++) {
      const measure = measures[i];
      if (measure.markers) {
        for (const marker of measure.markers) {
          if (marker === '|:') startRepeat[i] = true;
          if (marker === ':|') endRepeat[i] = true;
          if (marker === '[1.') volta[i] = 1;
          if (marker === '[2.') volta[i] = 2;
        }
      }
    }

    // Pass 2: Unroll
    let pc = 0;
    let repeatStart = 0;
    let playCount = 1;
    const outMeasures: Measure[] = [];
    let outMeasureNumber = 1;

    while (pc < measures.length) {
      if (startRepeat[pc]) {
        if (playCount === 1) {
          repeatStart = pc;
        }
      }

      if (volta[pc] !== undefined) {
        if (volta[pc] !== playCount) {
          // Skip until next volta or end of piece
          while (pc < measures.length) {
            pc++;
            if (pc < measures.length && volta[pc] !== undefined) {
              if (volta[pc] === playCount) {
                break;
              }
            }
          }
          if (pc >= measures.length) break;
        }
      }

      // Clone measure and strip markers
      const cloned = this.cloneAndStrip(measures[pc], outMeasureNumber++);
      outMeasures.push(cloned);

      if (endRepeat[pc]) {
        if (playCount === 1) {
          playCount = 2;
          pc = repeatStart;
          continue;
        } else {
          playCount = 1;
        }
      }

      pc++;
    }

    return {
      ...this.ast,
      measures: outMeasures
    };
  }

  private cloneAndStrip(measure: Measure, newNumber: number): Measure {
    const newParts: Part[] = measure.parts.map(part => {
      const newVoices: Voice[] = part.voices.map(voice => {
        // Deep clone events to avoid reference issues if we mutate them later
        // Using structuredClone for better performance and robustness
        return {
          id: voice.id,
          events: typeof structuredClone === 'function' ? structuredClone(voice.events) : JSON.parse(JSON.stringify(voice.events))
        };
      });
      return {
        id: part.id,
        meta: part.meta ? (typeof structuredClone === 'function' ? structuredClone(part.meta) : JSON.parse(JSON.stringify(part.meta))) : undefined,
        voices: newVoices
      };
    });

    return {
      number: newNumber,
      meta: measure.meta ? (typeof structuredClone === 'function' ? structuredClone(measure.meta) : JSON.parse(JSON.stringify(measure.meta))) : undefined,
      parts: newParts
      // markers are intentionally stripped
    };
  }
}
