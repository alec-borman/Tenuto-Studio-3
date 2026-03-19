import { AST, Event, Note, Chord, Tuplet } from '../compiler/parser';
import { EngraverLayout, ScoreLayout, SystemLayout, MeasureLayout, PositionedEvent } from './layout';

export class BoundingBox {
  constructor(public x: number, public y: number, public width: number, public height: number) {}

  intersects(other: BoundingBox): boolean {
    return !(
      this.x + this.width < other.x ||
      other.x + other.width < this.x ||
      this.y + this.height < other.y ||
      other.y + other.height < this.y
    );
  }
}

export class CollisionSystem {
  private boxes: BoundingBox[] = [];

  add(box: BoundingBox) {
    this.boxes.push(box);
  }

  collides(box: BoundingBox): boolean {
    return this.boxes.some(b => b.intersects(box));
  }

  resolveVertical(box: BoundingBox, direction: -1 | 1, step: number = 2): BoundingBox {
    let currentBox = new BoundingBox(box.x, box.y, box.width, box.height);
    while (this.collides(currentBox)) {
      currentBox.y += direction * step;
    }
    this.add(currentBox);
    return currentBox;
  }
}

export class SVGEngraver {
  private layoutEngine: EngraverLayout;

  constructor() {
    this.layoutEngine = new EngraverLayout();
  }

  public render(ast: AST): string {
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
      svg += `<text x="10" y="${staffY + 30}" class="clef">𝄞</text>`;
      
      // Barlines at start of system
      svg += `<line x1="0" y1="${staffY}" x2="0" y2="${staffY + 40}" class="barline" />`;
    });

    const collisionSystem = new CollisionSystem();

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
          svg += this.renderEvent(pe, staffY, collisionSystem, parts, staffSpacing);
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

  private renderEvent(pe: PositionedEvent, staffY: number, collisionSystem: CollisionSystem, parts: string[], staffSpacing: number): string {
    if (pe.event.type === 'note') {
      return this.renderNote(pe.event, pe.x, staffY, collisionSystem, parts, staffSpacing);
    } else if (pe.event.type === 'chord') {
      let svg = '';
      for (const note of pe.event.notes) {
        svg += this.renderNote(note, pe.x, staffY, collisionSystem, parts, staffSpacing);
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
          svg += this.renderEvent(ie, staffY, collisionSystem, parts, staffSpacing);
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
    }
    return '';
  }

  private renderNote(note: Note, x: number, staffY: number, collisionSystem: CollisionSystem, parts: string[], staffSpacing: number): string {
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
    const rx = 6 * scale;
    const ry = 4 * scale;
    
    // Notehead
    svg += `<ellipse cx="${x + 5}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(-20 ${x + 5} ${y})" class="notehead" />`;
    collisionSystem.add(new BoundingBox(x - 1, y - 4, 12 * scale, 8 * scale));
    
    if (isGrace && note.modifiers?.includes('slash')) {
      svg += `<line x1="${x - 2}" y1="${y + 5}" x2="${x + 12}" y2="${y - 15}" stroke="#000" stroke-width="1" />`;
    }

    // Stem
    const duration = parseFloat(note.duration || '4');
    let stemUp = y > targetStaffY + 20;
    
    if (note.cross) {
      stemUp = targetStaffY > staffY;
    }

    if (duration >= 2 || isGrace) {
      const stemHeight = 30 * scale;
      const stemX = stemUp ? x + 5 + rx : x + 5 - rx;
      
      let stemEndY = stemUp ? y - stemHeight : y + stemHeight;
      
      if (note.cross) {
        stemEndY = staffY + 20;
      }

      svg += `<line x1="${stemX}" y1="${y}" x2="${stemX}" y2="${stemEndY}" class="stem" />`;
      collisionSystem.add(new BoundingBox(stemX - 1, Math.min(y, stemEndY), 2, Math.abs(y - stemEndY)));
    }
    
    // Accidental
    if (note.accidental) {
      let accSymbol = '';
      if (note.accidental === '#') accSymbol = '♯';
      else if (note.accidental === 'b') accSymbol = '♭';
      else if (note.accidental === '+') accSymbol = '𝄲'; // Quarter sharp
      else if (note.accidental === '-') accSymbol = '𝄳'; // Quarter flat
      
      if (accSymbol) {
        // Resolve accidental collision
        const accBox = new BoundingBox(x - 15, y - 10, 10, 20);
        let currentAccBox = new BoundingBox(accBox.x, accBox.y, accBox.width, accBox.height);
        while (collisionSystem.collides(currentAccBox)) {
          currentAccBox.x -= 5;
        }
        collisionSystem.add(currentAccBox);
        svg += `<text x="${currentAccBox.x}" y="${y + 5}" font-family="serif" font-size="${18 * scale}px">${accSymbol}</text>`;
      }
    }

    // Articulation
    if (note.articulation) {
      if (note.articulation === 'slur' || note.articulation === 'tie') {
        const arcStartX = x + 5;
        const arcStartY = stemUp ? y + 10 : y - 10;
        const arcEndX = x + 30;
        const arcEndY = arcStartY;
        const controlY = stemUp ? arcStartY + 15 : arcStartY - 15;
        
        const arcBox = new BoundingBox(arcStartX, Math.min(arcStartY, controlY), arcEndX - arcStartX, Math.abs(controlY - arcStartY));
        const resolvedBox = collisionSystem.resolveVertical(arcBox, stemUp ? 1 : -1, 5);
        
        const dy = resolvedBox.y - arcBox.y;
        
        svg += `<path d="M ${arcStartX} ${arcStartY + dy} Q ${(arcStartX + arcEndX) / 2} ${controlY + dy} ${arcEndX} ${arcEndY + dy}" fill="none" stroke="#000" stroke-width="1.5" />`;
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

        let artY = stemUp ? y + 15 : y - 15;
        let direction: 1 | -1 = stemUp ? 1 : -1;
        
        if (['p', 'f', 'mf', 'mp', 'ff', 'pp'].includes(note.articulation)) {
          artY = targetStaffY + 60;
          direction = 1;
        }
        
        const artBox = new BoundingBox(x, artY - 5, 15, 15);
        const resolvedBox = collisionSystem.resolveVertical(artBox, direction, 5);
        
        const fontStyle = ['p', 'f', 'mf', 'mp', 'ff', 'pp'].includes(note.articulation) ? 'font-style="italic" font-weight="bold"' : '';
        
        svg += `<text x="${resolvedBox.x + 5}" y="${resolvedBox.y + 10}" font-family="serif" font-size="14px" text-anchor="middle" ${fontStyle}>${artSymbol}</text>`;
      }
    }
    
    return svg;
  }
}
