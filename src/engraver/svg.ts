import { AST, Event, Note, Chord, Tuplet, MacroCall } from '../compiler/parser';
import { EngraverLayout, ScoreLayout, SystemLayout, MeasureLayout, PositionedEvent } from './layout';
import { SMUFL_METADATA } from './smufl';
import { Skyline } from './skyline';

export class SVGEngraver {
  private layoutEngine: EngraverLayout;
  private ast: AST | null = null;

  constructor() {
    this.layoutEngine = new EngraverLayout();
  }

  public render(ast: AST): string {
    this.ast = ast;
    const layout = this.layoutEngine.layout(ast);
    return this.generateSVG(layout, ast);
  }

  private generateSVG(layout: ScoreLayout, ast: AST): string {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`;
    
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
    for (const system of layout.systems) {
      svg += this.renderSystem(system, ast);
    }

    svg += `</svg>`;
    return svg;
  }

  private renderSystem(system: SystemLayout, ast: AST): string {
    let svg = `<g transform="translate(0, ${system.y})">`;
    
    // Determine parts to render
    const parts = ast.defs.map(d => d.id);
    const staffHeight = 40; // 5 lines, 10px spacing
    const staffSpacing = 80;
    
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
      
      // Clef (Treble clef placeholder)
      const clefGlyph = SMUFL_METADATA['gClef'];
      svg += `<path d="${clefGlyph.path}" transform="translate(10, ${staffY + 30}) scale(10)" class="clef-path" fill="#000" />`;
      
      // Barlines at start of system
      svg += `<line x1="0" y1="${staffY}" x2="0" y2="${staffY + 40}" class="barline" />`;
    });

    const topSkyline = new Skyline(system.measures.reduce((sum, m) => sum + m.width, 0) + 100, 10, true);
    const bottomSkyline = new Skyline(system.measures.reduce((sum, m) => sum + m.width, 0) + 100, 10, false);

    // Render measures
    let currentX = 0;
    for (const measure of system.measures) {
      svg += `<g transform="translate(${currentX}, 0)">`;
      
      // Render events
      for (const partData of measure.events) {
        const partIndex = parts.indexOf(partData.partId);
        if (partIndex === -1) continue;
        
        const staffY = partIndex * staffSpacing;
        
        for (const pe of partData.positionedEvents) {
          svg += this.renderEvent(pe, staffY, topSkyline, bottomSkyline, parts, staffSpacing, currentX);
        }
      }
      
      // End barline
      parts.forEach((partId, partIndex) => {
        const staffY = partIndex * staffSpacing;
        svg += `<line x1="${measure.width}" y1="${staffY}" x2="${measure.width}" y2="${staffY + 40}" class="barline" />`;
      });
      
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

  private renderEvent(pe: PositionedEvent, staffY: number, topSkyline: Skyline, bottomSkyline: Skyline, parts: string[], staffSpacing: number, measureX: number): string {
    if (pe.event.type === 'note') {
      return this.renderNote(pe.event, pe.x, staffY, topSkyline, bottomSkyline, parts, staffSpacing, measureX);
    } else if (pe.event.type === 'chord') {
      let svg = '';
      for (const note of pe.event.notes) {
        svg += this.renderNote(note, pe.x, staffY, topSkyline, bottomSkyline, parts, staffSpacing, measureX);
      }
      return svg;
    } else if (pe.event.type === 'tuplet') {
      let svg = '';
      if (pe.internalEvents && pe.internalEvents.length > 0) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const ie of pe.internalEvents) {
          svg += this.renderEvent(ie, staffY, topSkyline, bottomSkyline, parts, staffSpacing, measureX);
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
        for (const macroEvent of macro.events) {
            let eventToRender = macroEvent;
            if (pe.event.transpose) {
                // We'd need to transpose the event here, but for now we'll just render it as is
                // since transposing requires a full pitch manipulation utility
            }
            
            // Create a mock positioned event for the macro event
            const mockPe: PositionedEvent = {
                event: eventToRender,
                x: currentX,
                y: pe.y,
                duration: 0, // Not used in renderEvent
                logicalTime: 0
            };
            
            svg += this.renderEvent(mockPe, staffY, topSkyline, bottomSkyline, parts, staffSpacing, measureX);
            currentX += 30; // Arbitrary spacing for macro events
        }
        return svg;
    }
    return '';
  }

  private renderNote(note: Note, x: number, staffY: number, topSkyline: Skyline, bottomSkyline: Skyline, parts: string[], staffSpacing: number, measureX: number): string {
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
    if (y > targetStaffY + 40) {
      for (let ly = targetStaffY + 50; ly <= y; ly += 10) {
        svg += `<line x1="${x - 6}" y1="${ly}" x2="${x + 16}" y2="${ly}" class="ledger" />`;
      }
    } else if (y < targetStaffY) {
      for (let ly = targetStaffY - 10; ly >= y; ly -= 10) {
        svg += `<line x1="${x - 6}" y1="${ly}" x2="${x + 16}" y2="${ly}" class="ledger" />`;
      }
    }
    
    const isGrace = note.modifiers?.includes('grace');
    const scale = isGrace ? 0.7 : 1;
    
    // Determine notehead type based on duration
    const duration = parseFloat(note.duration || '4');
    let glyphName = 'noteheadBlack';
    if (duration === 2) glyphName = 'noteheadHalf';
    if (duration === 1) glyphName = 'noteheadWhole';
    
    const glyph = SMUFL_METADATA[glyphName];
    const glyphScale = 10 * scale; // 1 staff space = 10px
    
    // Notehead
    const offsetX = x - glyph.opticalCenter * glyphScale;
    svg += `<path d="${glyph.path}" transform="translate(${offsetX + 5}, ${y}) scale(${glyphScale})" class="notehead" />`;
    
    // Update skylines for notehead
    const absoluteX = measureX + x;
    topSkyline.insert(absoluteX / 10, 1.2 * scale, y - 5 * scale);
    bottomSkyline.insert(absoluteX / 10, 1.2 * scale, y + 5 * scale);
    
    if (isGrace && note.modifiers?.includes('slash')) {
      svg += `<line x1="${x - 2}" y1="${y + 5}" x2="${x + 12}" y2="${y - 15}" stroke="#000" stroke-width="1" />`;
    }

    // Stem
    let stemUp = y > targetStaffY + 20;
    
    if (note.cross) {
      stemUp = targetStaffY > staffY;
    }

    if (duration >= 2 || isGrace) {
      const stemHeight = 30 * scale;
      
      // Use SMuFL stem attachment points
      const stemAnchor = stemUp ? glyph.stemUpSE : glyph.stemDownNW;
      const stemX = offsetX + 5 + stemAnchor[0] * glyphScale;
      const stemStartY = y + stemAnchor[1] * glyphScale;
      
      let stemEndY = stemUp ? stemStartY - stemHeight : stemStartY + stemHeight;
      
      if (note.cross) {
        stemEndY = staffY + 20;
      }

      svg += `<line x1="${stemX}" y1="${stemStartY}" x2="${stemX}" y2="${stemEndY}" class="stem" />`;
      
      // Update skylines for stem
      topSkyline.insert((measureX + stemX - 1) / 10, 0.2, Math.min(stemStartY, stemEndY));
      bottomSkyline.insert((measureX + stemX - 1) / 10, 0.2, Math.max(stemStartY, stemEndY));
    }
    
    // Accidental
    if (note.accidental) {
      let accSymbol = '';
      if (note.accidental === '#') accSymbol = '♯';
      else if (note.accidental === 'b') accSymbol = '♭';
      else if (note.accidental === '+') accSymbol = '𝄲'; // Quarter sharp
      else if (note.accidental === '-') accSymbol = '𝄳'; // Quarter flat
      
      if (accSymbol) {
        // Resolve accidental collision using skyline
        const accX = x - 15;
        svg += `<text x="${accX}" y="${y + 5}" font-family="serif" font-size="${18 * scale}px">${accSymbol}</text>`;
      }
    }

    // Articulation
    if (note.articulation) {
      if (note.articulation === 'slur' || note.articulation === 'tie') {
        const arcStartX = x + 5;
        const arcEndX = x + 30;
        
        // Use skyline to find the vertical position for the slur
        const arcWidth = 25;
        const height = 15;
        
        let arcStartY = 0;
        let controlY = 0;
        let arcEndY = 0;
        
        if (stemUp) {
          // Drop onto bottom skyline
          const resolvedY = bottomSkyline.drop((measureX + arcStartX) / 10, arcWidth / 10, height / 10, y + 10);
          arcStartY = resolvedY;
          arcEndY = resolvedY;
          controlY = resolvedY + height;
        } else {
          // Drop onto top skyline
          const resolvedY = topSkyline.drop((measureX + arcStartX) / 10, arcWidth / 10, height / 10, y - 10);
          arcStartY = resolvedY;
          arcEndY = resolvedY;
          controlY = resolvedY - height;
        }
        
        svg += `<path d="M ${arcStartX} ${arcStartY} Q ${(arcStartX + arcEndX) / 2} ${controlY} ${arcEndX} ${arcEndY}" fill="none" stroke="#000" stroke-width="1.5" />`;
      } else {
        let artSymbol = '';
        if (note.articulation === 'marc') artSymbol = '^';
        else if (note.articulation === 'staccato') artSymbol = '.';
        else if (note.articulation === 'tenuto') artSymbol = '-';
        else if (['p', 'f', 'mf', 'mp', 'ff', 'pp'].includes(note.articulation)) {
          artSymbol = note.articulation;
        } else {
          artSymbol = note.articulation;
        }

        let direction: 1 | -1 = stemUp ? 1 : -1;
        let artY = stemUp ? y + 15 : y - 15;
        
        if (['p', 'f', 'mf', 'mp', 'ff', 'pp'].includes(note.articulation)) {
          artY = targetStaffY + 60;
          direction = 1;
        }
        
        const fontStyle = ['p', 'f', 'mf', 'mp', 'ff', 'pp'].includes(note.articulation) ? 'font-style="italic" font-weight="bold"' : '';
        
        let resolvedY = artY;
        if (direction === 1) {
          resolvedY = bottomSkyline.drop((measureX + x) / 10, 1.5, 1.5, artY);
        } else {
          resolvedY = topSkyline.drop((measureX + x) / 10, 1.5, 1.5, artY);
        }
        
        svg += `<text x="${x + 5}" y="${resolvedY + (direction === 1 ? 10 : 0)}" font-family="serif" font-size="14px" text-anchor="middle" ${fontStyle}>${artSymbol}</text>`;
      }
    }
    
    // Lyrics
    if (note.lyric) {
      const lyricY = targetStaffY + 80; // Place lyrics below the staff
      const resolvedY = bottomSkyline.drop((measureX + x - 10) / 10, 4, 1.5, lyricY);
      
      svg += `<text x="${x + 5}" y="${resolvedY + 10}" font-family="sans-serif" font-size="12px" text-anchor="middle">${note.lyric}</text>`;
    }
    
    return svg;
  }
}
