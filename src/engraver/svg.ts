import { AST, Event, Note, Chord, Tuplet, MacroCall } from '../compiler/parser';
import { EngraverLayout, ScoreLayout, SystemLayout, MeasureLayout, PositionedEvent, LayoutOptions } from './layout';
import { SMUFL_METADATA } from './smufl';
import { Skyline } from './skyline';
import { Kurbo } from './kurbo';

export class SVGEngraver {
  private layoutEngine: EngraverLayout;
  private ast: AST | null = null;

  constructor(options?: Partial<LayoutOptions>) {
    this.layoutEngine = new EngraverLayout(options);
  }

  public render(ast: AST, diagnostics: any[] = []): { svgs: string[], layout: ScoreLayout } {
    this.ast = ast;
    const layout = this.layoutEngine.layout(ast);
    return { svgs: this.generateSVGs(layout, ast, diagnostics), layout };
  }

  private generateSVGs(layout: ScoreLayout, ast: AST, diagnostics: any[]): string[] {
    const svgs: string[] = [];
    
    for (const page of layout.pages) {
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}">`;
      
      // Add styles
      svg += `<style>
        .staff-line { stroke: #000; stroke-width: 1px; }
        .barline { stroke: #000; stroke-width: 1.5px; }
        .notehead { fill: #000; }
        .stem { stroke: #000; stroke-width: 1.2px; }
        .ledger { stroke: #000; stroke-width: 1.5px; }
        .clef { font-family: serif; font-size: 40px; }
        .time-sig { font-family: serif; font-size: 24px; font-weight: bold; }
      </style>`;

      // Render systems
      for (const system of page.systems) {
        svg += this.renderSystem(system, ast, diagnostics);
      }

      svg += `</svg>`;
      svgs.push(svg);
    }
    
    return svgs;
  }

  private renderSystem(system: SystemLayout, ast: AST, diagnostics: any[]): string {
    let svg = `<g transform="translate(0, ${system.y})">`;
    
    // Determine parts to render
    const parts = ast.defs.map(d => d.id);
    const staffHeight = 40; // 5 lines, 10px spacing
    const staffSpacing = 150;
    
    // Group parts by group name
    const groups: Record<string, number[]> = {};
    ast.defs.forEach((d, i) => {
      if (d.group) {
        if (!groups[d.group]) groups[d.group] = [];
        groups[d.group].push(i);
      }
    });

    // Render brackets for groups
    for (const groupName in groups) {
      const indices = groups[groupName];
      if (indices.length > 1) {
        const startY = Math.min(...indices) * staffSpacing;
        const endY = Math.max(...indices) * staffSpacing + staffHeight;
        
        // Draw a thick bracket
        svg += `<path d="M -5 ${startY} L -15 ${startY} L -15 ${endY} L -5 ${endY}" fill="none" stroke="#000" stroke-width="2" />`;
        // Draw group name
        svg += `<text x="-25" y="${(startY + endY) / 2}" font-family="sans-serif" font-size="12px" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 -25 ${(startY + endY) / 2})">${groupName}</text>`;
      }
    }

    // Render staff lines for each part
    parts.forEach((partId, partIndex) => {
      const staffY = partIndex * staffSpacing;
      
      // 5 lines
      for (let i = 0; i < 5; i++) {
        const y = staffY + i * 10;
        svg += `<line x1="0" y1="${y}" x2="${system.measures.reduce((sum, m) => sum + m.width, 0)}" y2="${y}" class="staff-line" />`;
      }
      
      // Clef (Unicode Fallback)
      const isTreble = partIndex === 0;
      const clefChar = isTreble ? "𝄞" : "𝄢";
      const clefY = isTreble ? staffY + 32 : staffY + 28;
      svg += `<text x="10" y="${clefY}" class="clef">${clefChar}</text>`;
      
      // Barlines at start of system
      let startBarline = `<line x1="0" y1="${staffY}" x2="0" y2="${staffY + 40}" class="barline" />`;
      if (system.measures[0] && system.measures[0].measure.markers?.includes('|:')) {
        startBarline = `
          <line x1="0" y1="${staffY}" x2="0" y2="${staffY + 40}" class="barline" stroke-width="3" />
          <line x1="4" y1="${staffY}" x2="4" y2="${staffY + 40}" class="barline" stroke-width="1" />
          <circle cx="8" cy="${staffY + 15}" r="2" fill="#000" />
          <circle cx="8" cy="${staffY + 25}" r="2" fill="#000" />
        `;
      }
      svg += startBarline;
    });

    const topSkyline = new Skyline(system.measures.reduce((sum, m) => sum + m.width, 0) + 100, 10, true);
    const bottomSkyline = new Skyline(system.measures.reduce((sum, m) => sum + m.width, 0) + 100, 10, false);

    // Render measures
    let currentX = 0;
    for (const measure of system.measures) {
      svg += `<g transform="translate(${currentX}, 0)">`;
      
      const accidentalState: Record<string, Record<string, string>> = {};

      // Render events
      for (const partData of measure.events) {
        const partIndex = parts.indexOf(partData.partId);
        if (partIndex === -1) continue;
        
        const staffY = partIndex * staffSpacing;
        if (!accidentalState[partData.partId]) accidentalState[partData.partId] = {};
        const partAccidentalState = accidentalState[partData.partId];

        // Beam grouping
        const beamGroups: PositionedEvent[][] = [];
        let currentBeamGroup: PositionedEvent[] = [];

        for (let i = 0; i < partData.positionedEvents.length; i++) {
          const pe = partData.positionedEvents[i];
          const isRest = pe.event.type === 'note' && pe.event.pitch === 'r';
          const dur = pe.duration;
          
          if (!isRest && dur > 0 && dur < 1) { // shorter than a quarter note
            if (currentBeamGroup.length === 0) {
              currentBeamGroup.push(pe);
            } else {
              const lastPe = currentBeamGroup[currentBeamGroup.length - 1];
              if (Math.floor(lastPe.logicalTime) === Math.floor(pe.logicalTime)) {
                currentBeamGroup.push(pe);
              } else {
                if (currentBeamGroup.length > 1) beamGroups.push(currentBeamGroup);
                currentBeamGroup = [pe];
              }
            }
          } else {
            if (currentBeamGroup.length > 1) beamGroups.push(currentBeamGroup);
            currentBeamGroup = [];
          }
        }
        if (currentBeamGroup.length > 1) beamGroups.push(currentBeamGroup);

        const beamedEvents = new Set<PositionedEvent>();
        const beamGroupLines = new Map<PositionedEvent, { startX: number, startY: number, endX: number, endY: number, stemUp: boolean }>();

        for (const group of beamGroups) {
          let sumY = 0;
          let count = 0;
          let hasCrossStaff = false;
          let minStaffY = staffY;
          let maxStaffY = staffY;

          for (const pe of group) {
            beamedEvents.add(pe);
            if (pe.event.type === 'note') {
              let targetStaffY = staffY;
              if (pe.event.cross) {
                const targetPartIndex = parts.indexOf(pe.event.cross);
                if (targetPartIndex !== -1) {
                  targetStaffY = targetPartIndex * staffSpacing;
                  hasCrossStaff = true;
                }
              }
              minStaffY = Math.min(minStaffY, targetStaffY);
              maxStaffY = Math.max(maxStaffY, targetStaffY);
              sumY += this.getPitchY(pe.event.pitch, pe.event.octave, targetStaffY);
              count++;
            } else if (pe.event.type === 'chord') {
              for (const n of pe.event.notes) {
                let targetStaffY = staffY;
                if (n.cross) {
                  const targetPartIndex = parts.indexOf(n.cross);
                  if (targetPartIndex !== -1) {
                    targetStaffY = targetPartIndex * staffSpacing;
                    hasCrossStaff = true;
                  }
                }
                minStaffY = Math.min(minStaffY, targetStaffY);
                maxStaffY = Math.max(maxStaffY, targetStaffY);
                sumY += this.getPitchY(n.pitch, n.octave, targetStaffY);
                count++;
              }
            }
          }
          
          const avgY = count > 0 ? sumY / count : staffY + 20;
          let stemUp = avgY > staffY + 20;
          
          const firstPe = group[0];
          const lastPe = group[group.length - 1];
          
          let startY, endY;
          
          if (hasCrossStaff) {
            // Knee beam: draw beam in the middle of the staves
            const midStaffY = (minStaffY + maxStaffY) / 2 + 20;
            startY = midStaffY;
            endY = midStaffY;
            // stemUp is determined per note later, but we set a default here
            stemUp = false; 
          } else {
            const firstY = this.getEventY(firstPe.event, staffY);
            const lastY = this.getEventY(lastPe.event, staffY);
            const stemDir = stemUp ? -1 : 1;
            const stemHeight = 30;
            
            startY = firstY + stemDir * stemHeight;
            endY = lastY + stemDir * stemHeight;
            
            const dy = endY - startY;
            const dx = lastPe.x - firstPe.x;
            if (dx > 0) {
              const slope = dy / dx;
              const maxSlope = 0.25;
              if (Math.abs(slope) > maxSlope) {
                const adjustedDy = Math.sign(slope) * maxSlope * dx;
                const midY = (startY + endY) / 2;
                startY = midY - adjustedDy / 2;
                endY = midY + adjustedDy / 2;
              }
            }
          }
          
          const lineData = { startX: firstPe.x, startY, endX: lastPe.x, endY, stemUp, hasCrossStaff };
          for (const pe of group) {
            beamGroupLines.set(pe, lineData as any);
          }
          
          // Draw primary beam
          // For knee beams, we might need to adjust stemOffset per note, but we'll use a middle value
          const stemOffset = 8; 
          svg += `<line x1="${firstPe.x + stemOffset}" y1="${startY}" x2="${lastPe.x + stemOffset}" y2="${endY}" stroke="#000" stroke-width="4" />`;
        }
        
        for (let i = 0; i < partData.positionedEvents.length; i++) {
          const pe = partData.positionedEvents[i];
          const nextPe = partData.positionedEvents[i + 1];
          svg += this.renderEvent(pe, nextPe, staffY, topSkyline, bottomSkyline, parts, staffSpacing, currentX, partAccidentalState, beamedEvents, beamGroupLines, diagnostics);
        }
      }
      
      // End barline
      parts.forEach((partId, partIndex) => {
        const staffY = partIndex * staffSpacing;
        let endBarline = `<line x1="${measure.width}" y1="${staffY}" x2="${measure.width}" y2="${staffY + 40}" class="barline" />`;
        
        if (measure.measure.markers?.includes(':|')) {
          endBarline = `
            <line x1="${measure.width - 4}" y1="${staffY}" x2="${measure.width - 4}" y2="${staffY + 40}" class="barline" stroke-width="1" />
            <line x1="${measure.width}" y1="${staffY}" x2="${measure.width}" y2="${staffY + 40}" class="barline" stroke-width="3" />
            <circle cx="${measure.width - 8}" cy="${staffY + 15}" r="2" fill="#000" />
            <circle cx="${measure.width - 8}" cy="${staffY + 25}" r="2" fill="#000" />
          `;
        }
        svg += endBarline;
      });
      
      // Voltas
      if (measure.measure.markers?.includes('[1.') || measure.measure.markers?.includes('[2.')) {
        const voltaText = measure.measure.markers.includes('[1.') ? '1.' : '2.';
        const startY = -15;
        svg += `
          <path d="M 0 ${startY + 10} L 0 ${startY} L ${measure.width} ${startY}" fill="none" stroke="#000" stroke-width="1" />
          <text x="5" y="${startY + 12}" font-family="sans-serif" font-size="12px" font-weight="bold">${voltaText}</text>
        `;
      }
      
      svg += `</g>`;
      currentX += measure.width;
    }

    svg += `</g>`;
    return svg;
  }

  private getPitchY(pitch: string, octave: number, staffY: number): number {
    if (pitch === 'r') {
      return staffY + 20; // Middle line of the staff
    }
    const pitchMap: Record<string, number> = {
      'c': 0, 'd': 1, 'e': 2, 'f': 3, 'g': 4, 'a': 5, 'b': 6
    };
    const step = pitchMap[pitch.toLowerCase()];
    const c4Y = staffY + 50;
    const stepsFromC4 = (octave - 4) * 7 + step;
    return c4Y - stepsFromC4 * 5;
  }

  private getEventY(event: Event, staffY: number): number {
    if (event.type === 'note') {
      return this.getPitchY(event.pitch, event.octave, staffY);
    } else if (event.type === 'chord') {
      let sum = 0;
      for (const n of event.notes) {
        sum += this.getPitchY(n.pitch, n.octave, staffY);
      }
      return sum / event.notes.length;
    } else if (event.type === 'tuplet' && event.events.length > 0) {
      return this.getEventY(event.events[0], staffY);
    }
    return staffY + 20;
  }

  private renderEvent(pe: PositionedEvent, nextPe: PositionedEvent | undefined, staffY: number, topSkyline: Skyline, bottomSkyline: Skyline, parts: string[], staffSpacing: number, measureX: number, partAccidentalState: Record<string, string>, beamedEvents: Set<PositionedEvent>, beamGroupLines: Map<PositionedEvent, { startX: number, startY: number, endX: number, endY: number, stemUp: boolean }>, diagnostics: any[]): string {
    if (pe.event.type === 'note') {
      return this.renderNote(pe, pe.event, pe.x, nextPe?.x, staffY, topSkyline, bottomSkyline, parts, staffSpacing, measureX, partAccidentalState, beamedEvents, beamGroupLines, diagnostics);
    } else if (pe.event.type === 'chord') {
      let svg = '';
      for (const note of pe.event.notes) {
        svg += this.renderNote(pe, note, pe.x, nextPe?.x, staffY, topSkyline, bottomSkyline, parts, staffSpacing, measureX, partAccidentalState, beamedEvents, beamGroupLines, diagnostics);
      }
      return svg;
    } else if (pe.event.type === 'tuplet') {
      let svg = '';
      if (pe.internalEvents && pe.internalEvents.length > 0) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (let i = 0; i < pe.internalEvents.length; i++) {
          const ie = pe.internalEvents[i];
          const nextIe = pe.internalEvents[i + 1];
          svg += this.renderEvent(ie, nextIe, staffY, topSkyline, bottomSkyline, parts, staffSpacing, measureX, partAccidentalState, beamedEvents, beamGroupLines, diagnostics);
          minX = Math.min(minX, ie.x);
          maxX = Math.max(maxX, ie.x);
          const y = this.getEventY(ie.event, staffY);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }

        // Draw tuplet bracket
        const firstEventY = this.getEventY(pe.internalEvents[0].event, staffY);
        const lastEventY = this.getEventY(pe.internalEvents[pe.internalEvents.length - 1].event, staffY);
        
        const bracketStartY = firstEventY - 25;
        const bracketEndY = lastEventY - 25;
        
        svg += `<path d="M ${minX} ${bracketStartY + 5} L ${minX} ${bracketStartY} L ${maxX} ${bracketEndY} L ${maxX} ${bracketEndY + 5}" fill="none" stroke="#000" stroke-width="1.2" />`;
        
        // Draw ratio text
        const midX = (minX + maxX) / 2;
        const midY = (bracketStartY + bracketEndY) / 2;
        svg += `<text x="${midX}" y="${midY - 5}" font-family="serif" font-size="12px" text-anchor="middle" font-style="italic">${pe.event.ratio}</text>`;
      }
      return svg;
    } else if (pe.event.type === 'macro_call') {
        const macro = this.ast?.macros.find(m => m.id === (pe.event as MacroCall).id);
        if (!macro) return '';
        
        let svg = '';
        let currentX = pe.x;
        // Simple rendering for macro events, just spacing them out a bit
        // A real implementation would need to properly layout the macro events
        for (let i = 0; i < macro.events.length; i++) {
            const macroEvent = macro.events[i];
            let eventToRender = macroEvent;
            
            // Create a mock positioned event for the macro event
            const mockPe: PositionedEvent = {
                event: eventToRender,
                x: currentX,
                y: pe.y,
                duration: 0, // Not used in renderEvent
                logicalTime: 0
            };
            
            svg += this.renderEvent(mockPe, undefined, staffY, topSkyline, bottomSkyline, parts, staffSpacing, measureX, partAccidentalState, beamedEvents, beamGroupLines, diagnostics);
            currentX += 30; // Arbitrary spacing for macro events
        }
        return svg;
    }
    return '';
  }

  private renderNote(pe: PositionedEvent, note: Note, x: number, nextX: number | undefined, staffY: number, topSkyline: Skyline, bottomSkyline: Skyline, parts: string[], staffSpacing: number, measureX: number, partAccidentalState: Record<string, string>, beamedEvents: Set<PositionedEvent>, beamGroupLines: Map<PositionedEvent, { startX: number, startY: number, endX: number, endY: number, stemUp: boolean }>, diagnostics: any[]): string {
    let targetStaffY = staffY;
    if (note.cross) {
      const targetPartIndex = parts.indexOf(note.cross);
      if (targetPartIndex !== -1) {
        targetStaffY = targetPartIndex * staffSpacing;
      }
    }

    const y = this.getPitchY(note.pitch, note.octave, targetStaffY);
    
    let svg = '';
    
    // Ledger lines
    if (note.pitch !== 'r') {
      // Add a sanity check to prevent infinite loops or millions of lines
      // if the pitch calculation goes wild (e.g. octave is NaN or huge)
      const maxLedgers = 15; // Max 15 ledger lines (~150px)
      if (y > targetStaffY + 40 && y <= targetStaffY + 40 + maxLedgers * 10) {
        for (let ly = targetStaffY + 50; ly <= y; ly += 10) {
          svg += `<line x1="${x - 6}" y1="${ly}" x2="${x + 16}" y2="${ly}" class="ledger" />`;
        }
      } else if (y < targetStaffY && y >= targetStaffY - maxLedgers * 10) {
        for (let ly = targetStaffY - 10; ly >= y; ly -= 10) {
          svg += `<line x1="${x - 6}" y1="${ly}" x2="${x + 16}" y2="${ly}" class="ledger" />`;
        }
      }
    }
    
    const isGrace = note.modifiers?.includes('grace');
    const scale = isGrace ? 0.7 : 1;
    
    // Determine notehead type based on duration
    let durationVal = 4;
    let durStr = note.duration || '4';
    if (durStr.endsWith('.')) durStr = durStr.slice(0, -1);
    const parsedDur = parseInt(durStr, 10);
    if (!isNaN(parsedDur) && parsedDur > 0) durationVal = parsedDur;

    let glyphName = 'noteheadBlack';
    if (durationVal === 2) glyphName = 'noteheadHalf';
    if (durationVal === 1) glyphName = 'noteheadWhole';
    
    const glyph = SMUFL_METADATA[glyphName];
    const glyphScale = 10 * scale; // 1 staff space = 10px
    
    // Notehead
    const offsetX = x - glyph.opticalCenter * glyphScale;
    svg += `<path d="${glyph.path}" transform="translate(${offsetX + 5}, ${y}) scale(${glyphScale})" class="notehead" />`;
    
    // Update skylines for notehead
    const absoluteX = measureX + x;
    topSkyline.insert(absoluteX / 10, 1.2 * scale, y - 5 * scale);
    bottomSkyline.insert(absoluteX / 10, 1.2 * scale, y + 5 * scale);
    
    const hasWarning = diagnostics.some(d => d.location.line === note.line && d.location.column === note.column);
    if (hasWarning) {
      svg += `<rect x="${x - 5}" y="${y - 10}" width="20" height="20" fill="rgba(234, 179, 8, 0.3)" />`;
      const skyY = topSkyline.peek(absoluteX / 10);
      svg += `<text x="${x + 5}" y="${skyY - 10}" font-size="14px" fill="rgba(234, 179, 8, 1)" text-anchor="middle">⚠</text>`;
    }

    if (isGrace && note.modifiers?.includes('slash')) {
      svg += `<line x1="${x - 2}" y1="${y + 5}" x2="${x + 12}" y2="${y - 15}" stroke="#000" stroke-width="1" />`;
    }

    // Stem
    let stemUp = y > targetStaffY + 20;
    
    if (note.cross) {
      stemUp = targetStaffY > staffY;
    }

    const isBeamed = beamedEvents.has(pe);
    let beamLine: any = null;
    if (isBeamed) {
      beamLine = beamGroupLines.get(pe)!;
      if (beamLine.hasCrossStaff) {
        stemUp = y > beamLine.startY;
      } else {
        stemUp = beamLine.stemUp;
      }
    }

    if (durationVal >= 2 || isGrace || isBeamed) {
      const stemHeight = 30 * scale;
      
      // Use SMuFL stem attachment points
      const stemAnchor = stemUp ? glyph.stemUpSE : glyph.stemDownNW;
      const stemX = offsetX + 5 + stemAnchor[0] * glyphScale;
      const stemStartY = y + stemAnchor[1] * glyphScale;
      
      let stemEndY = stemUp ? stemStartY - stemHeight : stemStartY + stemHeight;
      
      if (note.cross && !isBeamed) {
        stemEndY = staffY + 20;
      }

      if (isBeamed && beamLine) {
        const t = (x - beamLine.startX) / (beamLine.endX - beamLine.startX || 1);
        stemEndY = beamLine.startY + t * (beamLine.endY - beamLine.startY);
      }

      svg += `<line x1="${stemX}" y1="${stemStartY}" x2="${stemX}" y2="${stemEndY}" class="stem" />`;
      
      // Update skylines for stem
      topSkyline.insert((measureX + stemX - 1) / 10, 0.2, Math.min(stemStartY, stemEndY));
      bottomSkyline.insert((measureX + stemX - 1) / 10, 0.2, Math.max(stemStartY, stemEndY));
    }
    
    // Accidental
    if (note.pitch !== 'r') {
      const pitchKey = `${note.pitch.toLowerCase()}${note.octave}`;
      const currentAccidental = note.accidental || '';
      const previousAccidental = partAccidentalState[pitchKey] || '';

      let accSymbol = '';
      if (currentAccidental !== previousAccidental) {
        if (currentAccidental === '#') accSymbol = '♯';
        else if (currentAccidental === 'b') accSymbol = '♭';
        else if (currentAccidental === '+') accSymbol = '𝄲'; // Quarter sharp
        else if (currentAccidental === '-') accSymbol = '𝄳'; // Quarter flat
        else if (currentAccidental === '') accSymbol = '♮'; // Natural
        
        partAccidentalState[pitchKey] = currentAccidental;
      }

      if (accSymbol) {
        // Resolve accidental collision using skyline
        const accX = x - 15;
        svg += `<text x="${accX}" y="${y + 5}" font-family="serif" font-size="${18 * scale}px">${accSymbol}</text>`;
      }
    }

    // Articulations and Modifiers
    if (note.modifiers) {
      const articulations = ['staccato', 'stacc', 'tenuto', 'marc', 'slur', 'tie'];
      const dynamics = ['p', 'f', 'mf', 'mp', 'ff', 'pp'];
      
      // Sort articulations: Staccato -> Tenuto -> Marcato -> Slur -> Text
      const sortedMods = [...note.modifiers].sort((a, b) => {
        const orderA = articulations.indexOf(a);
        const orderB = articulations.indexOf(b);
        if (orderA !== -1 && orderB !== -1) return orderA - orderB;
        if (orderA !== -1) return -1;
        if (orderB !== -1) return 1;
        return 0;
      });

      for (const mod of sortedMods) {
        if (mod === 'slur' || mod === 'tie') {
          const arcStartX = x + 5;
          const arcEndX = nextX ? nextX + 5 : x + 30;
          
          const isTop = !stemUp;
          const skyline = isTop ? topSkyline : bottomSkyline;
          const dir = isTop ? -1 : 1;
          
          const p0 = { x: arcStartX, y: y + dir * 10 };
          const p3 = { x: arcEndX, y: y + dir * 10 };
          
          const [cp0, cp1, cp2, cp3] = Kurbo.routeSlur(p0, p3, skyline, isTop, measureX);
          
          svg += `<path d="M ${cp0.x} ${cp0.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${cp3.x} ${cp3.y}" fill="none" stroke="#000" stroke-width="1.5" />`;
        } else if (articulations.includes(mod) || dynamics.includes(mod)) {
          let artSymbol = '';
          if (mod === 'marc') artSymbol = '^';
          else if (mod === 'staccato' || mod === 'stacc') artSymbol = '.';
          else if (mod === 'tenuto') artSymbol = '-';
          else artSymbol = mod;

          let direction: 1 | -1 = stemUp ? 1 : -1;
          let artY = stemUp ? y + 15 : y - 15;
          
          if (dynamics.includes(mod)) {
            artY = targetStaffY + 60;
            direction = 1;
          }
          
          const fontStyle = dynamics.includes(mod) ? 'font-style="italic" font-weight="bold"' : '';
          
          let resolvedY = artY;
          if (direction === 1) {
            resolvedY = bottomSkyline.drop((measureX + x) / 10, 1.5, 1.5, artY);
          } else {
            resolvedY = topSkyline.drop((measureX + x) / 10, 1.5, 1.5, artY);
          }
          
          svg += `<text x="${x + 5}" y="${resolvedY + (direction === 1 ? 10 : 0)}" font-family="serif" font-size="14px" text-anchor="middle" ${fontStyle}>${artSymbol}</text>`;
        } else if (mod === 'crescendo' || mod === 'diminuendo') {
          const startX = x + 5;
          const endX = nextX ? nextX - 5 : x + 30;
          const yPos = targetStaffY + 65;
          
          if (mod === 'crescendo') {
            svg += `
              <line x1="${startX}" y1="${yPos}" x2="${endX}" y2="${yPos - 5}" stroke="#000" stroke-width="1" />
              <line x1="${startX}" y1="${yPos}" x2="${endX}" y2="${yPos + 5}" stroke="#000" stroke-width="1" />
            `;
          } else {
            svg += `
              <line x1="${startX}" y1="${yPos - 5}" x2="${endX}" y2="${yPos}" stroke="#000" stroke-width="1" />
              <line x1="${startX}" y1="${yPos + 5}" x2="${endX}" y2="${yPos}" stroke="#000" stroke-width="1" />
            `;
          }
        }
      }
    }
    
    // Lyrics
    if (note.lyric) {
      const lyricY = targetStaffY + 80; // Place lyrics below the staff
      const resolvedY = bottomSkyline.drop((measureX + x - 10) / 10, 4, 1.5, lyricY);
      
      let text = note.lyric;
      const hasHyphen = text.endsWith('-');
      const hasMelisma = text.endsWith('_');
      
      if (hasHyphen || hasMelisma) {
        text = text.slice(0, -1);
      }
      
      // Approximate text width (very rough)
      const textWidth = text.length * 6;
      const textStartX = x + 5 - textWidth / 2;
      const textEndX = x + 5 + textWidth / 2;
      
      if (text.length > 0) {
        svg += `<text x="${x + 5}" y="${resolvedY + 10}" font-family="sans-serif" font-size="12px" text-anchor="middle">${text}</text>`;
      }
      
      if (hasHyphen && nextX !== undefined) {
        const gap = nextX - textEndX;
        const staffSpace = 10;
        const threshold = 3 * staffSpace;
        
        if (gap > threshold) {
          // Multiple equidistant hyphens
          const numHyphens = Math.floor(gap / threshold);
          const spacing = gap / (numHyphens + 1);
          for (let i = 1; i <= numHyphens; i++) {
            const hx = textEndX + i * spacing;
            svg += `<text x="${hx}" y="${resolvedY + 10}" font-family="sans-serif" font-size="12px" text-anchor="middle">-</text>`;
          }
        } else if (gap > 10) {
          // Single centered hyphen
          const hx = textEndX + gap / 2;
          svg += `<text x="${hx}" y="${resolvedY + 10}" font-family="sans-serif" font-size="12px" text-anchor="middle">-</text>`;
        }
      } else if (hasMelisma && nextX !== undefined) {
        const lineStartX = textEndX + 2;
        const lineEndX = nextX + 5; // To the center of the next note
        if (lineEndX > lineStartX) {
          svg += `<line x1="${lineStartX}" y1="${resolvedY + 12}" x2="${lineEndX}" y2="${resolvedY + 12}" stroke="#000" stroke-width="1" />`;
        }
      }
    }
    
    return svg;
  }
}
