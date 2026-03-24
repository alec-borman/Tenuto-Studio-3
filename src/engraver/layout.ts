import { AST, Measure, Event, Voice, Part, MacroCall } from '../compiler/parser';

export interface LayoutOptions {
  systemWidth: number;
  spacingConstant: number; // C in C * d^k
  spacingExponent: number; // k in C * d^k
  measurePadding: number;
  pageHeight: number;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  systemWidth: 800,
  spacingConstant: 40,
  spacingExponent: 0.6,
  measurePadding: 20,
  pageHeight: 2970,
};

export interface PositionedEvent {
  event: Event;
  x: number;
  y: number;
  duration: number;
  logicalTime: number;
  internalEvents?: PositionedEvent[];
}

export interface MeasureLayout {
  measure: Measure;
  x: number;
  width: number;
  idealWidth: number;
  events: { partId: string; voiceId: string; positionedEvents: PositionedEvent[] }[];
}

export interface SystemLayout {
  y: number;
  height: number;
  measures: MeasureLayout[];
}

export interface PageLayout {
  systems: SystemLayout[];
  width: number;
  height: number;
}

export interface ScoreLayout {
  pages: PageLayout[];
  width: number;
  height: number;
}

export class EngraverLayout {
  private options: LayoutOptions;
  private macroDurations: Map<string, number> = new Map();

  constructor(options: Partial<LayoutOptions> = {}) {
    this.options = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  }

  public layout(ast: AST): ScoreLayout {
    this.macroDurations.clear();
    for (const macro of ast.macros) {
        let duration = 0;
        for (const event of macro.events) {
            duration += this.getEventDuration(event);
        }
        this.macroDurations.set(macro.id, duration);
    }
    const measureLayouts = this.calculateMeasureIdealWidths(ast);
    return this.breakIntoSystems(measureLayouts);
  }

  private calculateMeasureIdealWidths(ast: AST): MeasureLayout[] {
    return ast.measures.map(measure => {
      // 1. Find all unique rhythmic positions in the measure
      const positions = new Set<number>();
      positions.add(0);

      const eventMap: { partId: string; voiceId: string; positionedEvents: PositionedEvent[] }[] = [];

      for (const part of measure.parts) {
        for (const voice of part.voices) {
          let currentTime = 0;
          const positionedEvents: PositionedEvent[] = [];
          
          for (const event of voice.events) {
            const isGrace = (event.type === 'note' || event.type === 'chord') && event.modifiers?.includes('grace');
            
            let duration = 0;
            if (isGrace) {
              duration = 0;
            } else {
              duration = this.getEventDuration(event);
            }
            
            positions.add(currentTime);
            
            let internalEvents: PositionedEvent[] | undefined;
            if (event.type === 'tuplet') {
              internalEvents = [];
              let tupletTime = 0;
              const ratioParts = event.ratio.split('/');
              let num = 3;
              let den = 2;
              if (ratioParts.length === 2) {
                num = parseInt(ratioParts[0], 10);
                den = parseInt(ratioParts[1], 10);
              } else if (ratioParts.length === 1) {
                num = parseInt(ratioParts[0], 10);
                den = Math.pow(2, Math.floor(Math.log2(num)));
                if (num === den) den = num / 2;
              }
              const multiplier = den / num;
              
              for (const e of event.events) {
                const eDur = this.getEventDuration(e) * multiplier;
                internalEvents.push({ event: e, x: 0, y: 0, duration: eDur, logicalTime: tupletTime });
                tupletTime += eDur;
                positions.add(currentTime + tupletTime);
              }
            }
            
            positionedEvents.push({ event, x: 0, y: 0, duration, logicalTime: currentTime, internalEvents });
            
            if (!isGrace) {
              currentTime += duration;
            } else {
              // Add a small logical offset for grace notes so they get their own X position
              currentTime += 0.001; 
            }
          }
          positions.add(currentTime);
          eventMap.push({ partId: part.id, voiceId: voice.id, positionedEvents });
        }
      }

      const sortedPositions = Array.from(positions).sort((a, b) => a - b);
      
      // 2. Calculate Springs and Rods between consecutive positions
      const positionX = new Map<number, number>();
      let currentX = this.options.measurePadding;
      positionX.set(0, currentX);

      for (let i = 0; i < sortedPositions.length - 1; i++) {
        const d = sortedPositions[i + 1] - sortedPositions[i];
        
        // Spring: optical space based on rhythmic duration
        let spring = 0;
        if (d < 0.01) {
          spring = 15; // Fixed space for grace notes
        } else {
          spring = this.options.spacingConstant * Math.pow(d, this.options.spacingExponent);
        }

        // Rod: absolute minimum physical width to prevent overlapping ink
        // A basic approximation: each column needs at least 20px of physical space
        // In a real engine, this would depend on the actual glyphs in the column (accidentals, ledger lines, etc.)
        let rod = 20; 
        if (d < 0.01) {
          rod = 12; // Grace notes can be tighter
        }

        // Task 1A: Visual Spanners
        // Check if any event at this position has a lyric
        const eventsAtPos = eventMap.map(v => v.positionedEvents.find(pe => pe.logicalTime === sortedPositions[i])).filter(pe => pe !== undefined) as PositionedEvent[];
        for (const pe of eventsAtPos) {
          if (pe.event.type === 'note' || pe.event.type === 'chord') {
            if (pe.event.lyric) {
              // Base width for the lyric text (approx 6px per char)
              let lyricWidth = pe.event.lyric.length * 6;
              if (pe.event.lyric.endsWith('-') || pe.event.lyric.endsWith('_')) {
                lyricWidth += 20; // Extra space for the spanner
              }
              rod = Math.max(rod, lyricWidth);
            }
          }
        }

        // Constraint solver pass: actual distance is spring length, but never less than rod length
        const space = Math.max(spring, rod);
        
        currentX += space;
        positionX.set(sortedPositions[i + 1], currentX);
      }

      const idealWidth = currentX + this.options.measurePadding;

      // 3. Assign X coordinates to events
      for (const voiceData of eventMap) {
        for (const pe of voiceData.positionedEvents) {
          pe.x = positionX.get(pe.logicalTime) || 0;
          if (pe.internalEvents) {
            for (const ie of pe.internalEvents) {
              ie.x = positionX.get(pe.logicalTime + ie.logicalTime) || 0;
            }
          }
        }
      }

      // 4. Resolve polyphonic collisions (Tuck & Shift)
      if (eventMap.length > 1) {
        for (const pos of sortedPositions) {
          const eventsAtPos = eventMap.map(v => v.positionedEvents.find(pe => pe.logicalTime === pos)).filter(pe => pe !== undefined) as PositionedEvent[];
          
          if (eventsAtPos.length > 1) {
            // Simple collision detection for 2 voices
            const e1 = eventsAtPos[0].event;
            const e2 = eventsAtPos[1].event;
            
            if (e1.type === 'note' && e2.type === 'note' && e1.pitch !== 'r' && e2.pitch !== 'r') {
              const pitchMap: Record<string, number> = { 'c': 0, 'd': 1, 'e': 2, 'f': 3, 'g': 4, 'a': 5, 'b': 6 };
              const step1 = e1.octave * 7 + pitchMap[e1.pitch.toLowerCase()];
              const step2 = e2.octave * 7 + pitchMap[e2.pitch.toLowerCase()];
              
              const diff = Math.abs(step1 - step2);
              if (diff <= 1) { // Unison or 2nd
                // Displace the lower voice
                if (step1 < step2) {
                  eventsAtPos[0].x += 12; // Shift right
                } else {
                  eventsAtPos[1].x += 12; // Shift right
                }
              }
            }
          }
        }
      }

      return {
        measure,
        x: 0,
        width: idealWidth,
        idealWidth,
        events: eventMap
      };
    });
  }

  private breakIntoSystems(measures: MeasureLayout[]): ScoreLayout {
    const n = measures.length;
    if (n === 0) return { pages: [], width: this.options.systemWidth, height: 0 };

    const dp = new Array(n + 1).fill(Infinity);
    const parent = new Array(n + 1).fill(-1);
    dp[0] = 0;

    for (let i = 0; i < n; i++) {
      if (dp[i] === Infinity) continue;
      
      let currentWidth = 0;
      for (let j = i + 1; j <= n; j++) {
        currentWidth += measures[j - 1].idealWidth;
        const R = this.options.systemWidth / currentWidth;
        
        let cost = 0;
        const isLastLine = (j === n);
        
        if (R < 0.5) {
          if (j > i + 1) break; // Too compressed, adding more measures will only make it worse
          cost = 10000; // Force at least one measure per line if it's extremely wide
        } else if (R > 3.0 && !isLastLine) {
          cost = 10000; // Too stretched
        } else {
          if (isLastLine && R > 1.0) {
            cost = (R - 1) * (R - 1) * 10; // Last line can be shorter
          } else {
            cost = (R - 1) * (R - 1) * 100;
          }
        }
        
        // Widow/orphan penalty
        if (isLastLine && j - i === 1 && i > 0) {
          cost += 500;
        }
        
        if (dp[i] + cost < dp[j]) {
          dp[j] = dp[i] + cost;
          parent[j] = i;
        }
      }
    }

    // Backtrack to find the optimal breaks
    const breaks: number[] = [];
    let curr = n;
    while (curr > 0) {
      breaks.push(curr);
      curr = parent[curr];
    }
    breaks.push(0);
    breaks.reverse();

    const pages: PageLayout[] = [];
    let currentSystems: SystemLayout[] = [];
    let currentY = 50;
    const systemHeight = 150;
    const pageMarginTop = 50;
    const pageMarginBottom = 50;

    for (let k = 0; k < breaks.length - 1; k++) {
      const start = breaks[k];
      const end = breaks[k + 1];
      const systemMeasures = measures.slice(start, end);
      
      let totalIdealWidth = 0;
      for (const m of systemMeasures) totalIdealWidth += m.idealWidth;
      
      const isLast = (end === n);
      this.justifySystem(systemMeasures, totalIdealWidth, isLast);
      
      if (currentY + systemHeight + pageMarginBottom > this.options.pageHeight && currentSystems.length > 0) {
        pages.push({
          systems: currentSystems,
          width: this.options.systemWidth,
          height: this.options.pageHeight
        });
        currentSystems = [];
        currentY = pageMarginTop;
      }

      currentSystems.push({ y: currentY, height: systemHeight, measures: systemMeasures });
      currentY += systemHeight + 50;
    }

    if (currentSystems.length > 0) {
      pages.push({
        systems: currentSystems,
        width: this.options.systemWidth,
        height: Math.max(currentY, this.options.pageHeight)
      });
    }

    return {
      pages,
      width: this.options.systemWidth,
      height: pages.length * this.options.pageHeight
    };
  }

  private justifySystem(measures: MeasureLayout[], totalIdealWidth: number, isLast: boolean = false) {
    let currentX = 0;
    const stretchFactor = isLast && totalIdealWidth < this.options.systemWidth * 0.7 
      ? 1.0 
      : this.options.systemWidth / totalIdealWidth;

    for (const measure of measures) {
      measure.x = currentX;
      measure.width = measure.idealWidth * stretchFactor;
      
      // Scale event X coordinates
      for (const voiceData of measure.events) {
        for (const pe of voiceData.positionedEvents) {
          // Keep padding constant, stretch the inner spacing
          const innerX = pe.x - this.options.measurePadding;
          pe.x = this.options.measurePadding + innerX * stretchFactor;
        }
      }
      
      currentX += measure.width;
    }
  }

  private getEventDuration(event: Event): number {
    if (event.type === 'macro_call') {
        return this.macroDurations.get(event.id) || 0;
    }
    if (event.type === 'note' || event.type === 'chord') {
      return this.parseDuration(event.duration);
    } else if (event.type === 'tuplet') {
      let total = 0;
      for (const e of event.events) {
        total += this.getEventDuration(e);
      }
      const ratioParts = event.ratio.split('/');
      let num = 3;
      let den = 2;
      if (ratioParts.length === 2) {
        num = parseInt(ratioParts[0], 10);
        den = parseInt(ratioParts[1], 10);
      } else if (ratioParts.length === 1) {
        num = parseInt(ratioParts[0], 10);
        den = Math.pow(2, Math.floor(Math.log2(num)));
        if (num === den) den = num / 2;
      }
      return total * (den / num);
    }
    return 0;
  }

  private parseDuration(durStr: string): number {
    let base = 4;
    let dotted = false;
    if (durStr.endsWith('.')) {
      dotted = true;
      durStr = durStr.slice(0, -1);
    }
    if (durStr) {
      base = parseInt(durStr, 10);
      if (isNaN(base) || base <= 0) return 0;
    }
    let duration = 4 / base;
    if (dotted) duration *= 1.5;
    return duration;
  }
}
