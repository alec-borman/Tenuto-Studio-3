import { AST, Measure, Event, Voice, Part } from '../compiler/parser';

export interface LayoutOptions {
  systemWidth: number;
  spacingConstant: number; // C in C * d^k
  spacingExponent: number; // k in C * d^k
  measurePadding: number;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  systemWidth: 800,
  spacingConstant: 40,
  spacingExponent: 0.6,
  measurePadding: 20,
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

export interface ScoreLayout {
  systems: SystemLayout[];
  width: number;
  height: number;
}

export class EngraverLayout {
  private options: LayoutOptions;

  constructor(options: Partial<LayoutOptions> = {}) {
    this.options = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  }

  public layout(ast: AST): ScoreLayout {
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
              const multiplier = ratioParts.length === 2 ? parseInt(ratioParts[1], 10) / parseInt(ratioParts[0], 10) : 1;
              
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
      
      // 2. Calculate Gourlay spacing between consecutive positions
      const positionX = new Map<number, number>();
      let currentX = this.options.measurePadding;
      positionX.set(0, currentX);

      for (let i = 0; i < sortedPositions.length - 1; i++) {
        const d = sortedPositions[i + 1] - sortedPositions[i];
        let space = 0;
        if (d < 0.01) {
          space = 15; // Fixed space for grace notes
        } else {
          space = this.options.spacingConstant * Math.pow(d, this.options.spacingExponent);
        }
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
    const systems: SystemLayout[] = [];
    let currentSystemMeasures: MeasureLayout[] = [];
    let currentSystemWidth = 0;
    let currentY = 50;
    const systemHeight = 150; // Fixed for now, should depend on parts

    for (const measure of measures) {
      if (currentSystemMeasures.length > 0 && currentSystemWidth + measure.idealWidth > this.options.systemWidth) {
        // Justify current system
        this.justifySystem(currentSystemMeasures, currentSystemWidth);
        systems.push({ y: currentY, height: systemHeight, measures: currentSystemMeasures });
        
        currentY += systemHeight + 50;
        currentSystemMeasures = [measure];
        currentSystemWidth = measure.idealWidth;
      } else {
        currentSystemMeasures.push(measure);
        currentSystemWidth += measure.idealWidth;
      }
    }

    if (currentSystemMeasures.length > 0) {
      // Don't fully justify the last system if it's too short, but we'll do it simply for now
      this.justifySystem(currentSystemMeasures, currentSystemWidth, true);
      systems.push({ y: currentY, height: systemHeight, measures: currentSystemMeasures });
    }

    return {
      systems,
      width: this.options.systemWidth,
      height: currentY + systemHeight + 50
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
    if (event.type === 'note' || event.type === 'chord') {
      return this.parseDuration(event.duration);
    } else if (event.type === 'tuplet') {
      let total = 0;
      for (const e of event.events) {
        total += this.getEventDuration(e);
      }
      const ratioParts = event.ratio.split('/');
      if (ratioParts.length === 2) {
        const num = parseInt(ratioParts[0], 10);
        const den = parseInt(ratioParts[1], 10);
        return total * (den / num);
      }
      return total;
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
