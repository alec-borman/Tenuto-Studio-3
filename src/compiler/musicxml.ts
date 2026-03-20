import { AST, Measure, Part, Voice, Event, Note, Chord, Tuplet, MacroCall } from './parser';

export class MusicXMLExporter {
  public export(ast: AST): string {
    let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
    xml += `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n`;
    xml += `<score-partwise version="4.0">\n`;

    // Work title
    if (ast.meta.title) {
      xml += `  <work>\n    <work-title>${this.escape(ast.meta.title)}</work-title>\n  </work>\n`;
    }

    // Part list
    xml += `  <part-list>\n`;
    for (const def of ast.defs) {
      xml += `    <score-part id="${def.id}">\n`;
      xml += `      <part-name>${this.escape(def.name)}</part-name>\n`;
      // We could map patches to MIDI instruments here
      xml += `    </score-part>\n`;
    }
    xml += `  </part-list>\n`;

    // Parts and measures
    for (const def of ast.defs) {
      xml += `  <part id="${def.id}">\n`;
      
      for (const measure of ast.measures) {
        xml += `    <measure number="${measure.number}">\n`;
        
        // Attributes (clef, key, time) on first measure
        if (measure.number === 1) {
          xml += `      <attributes>\n`;
          xml += `        <divisions>24</divisions>\n`; // 24 divisions per quarter note
          
          if (ast.meta.time) {
            const [beats, beatType] = ast.meta.time.split('/');
            xml += `        <time>\n`;
            xml += `          <beats>${beats}</beats>\n`;
            xml += `          <beat-type>${beatType}</beat-type>\n`;
            xml += `        </time>\n`;
          }
          
          // Default clef (Treble)
          xml += `        <clef>\n`;
          xml += `          <sign>G</sign>\n`;
          xml += `          <line>2</line>\n`;
          xml += `        </clef>\n`;
          
          xml += `      </attributes>\n`;
          
          // Tempo
          if (ast.meta.tempo) {
            xml += `      <direction placement="above">\n`;
            xml += `        <direction-type>\n`;
            xml += `          <metronome>\n`;
            xml += `            <beat-unit>quarter</beat-unit>\n`;
            xml += `            <per-minute>${ast.meta.tempo}</per-minute>\n`;
            xml += `          </metronome>\n`;
            xml += `        </direction-type>\n`;
            xml += `        <sound tempo="${ast.meta.tempo}"/>\n`;
            xml += `      </direction>\n`;
          }
        }

        const part = measure.parts.find(p => p.id === def.id);
        if (part) {
          // For simplicity, we just export the first voice
          const voice = part.voices[0];
          if (voice) {
            for (const event of voice.events) {
              xml += this.exportEvent(event, ast);
            }
          }
        }
        
        xml += `    </measure>\n`;
      }
      
      xml += `  </part>\n`;
    }

    xml += `</score-partwise>\n`;
    return xml;
  }

  private exportEvent(event: Event, ast: AST): string {
    let xml = '';
    if (event.type === 'note') {
      xml += this.exportNote(event);
    } else if (event.type === 'chord') {
      for (let i = 0; i < event.notes.length; i++) {
        xml += this.exportNote(event.notes[i], i > 0, event.duration);
      }
    } else if (event.type === 'macro_call') {
      const macro = ast.macros.find(m => m.id === event.id);
      if (macro) {
        for (const e of macro.events) {
          xml += this.exportEvent(e, ast);
        }
      }
    }
    // Tuplets are more complex, skipping for MVP
    return xml;
  }

  private exportNote(note: Note, isChord: boolean = false, overrideDuration?: string): string {
    let xml = `      <note>\n`;
    
    if (isChord) {
      xml += `        <chord/>\n`;
    }

    if (note.pitch === 'r') {
      xml += `        <rest/>\n`;
    } else {
      xml += `        <pitch>\n`;
      xml += `          <step>${note.pitch.toUpperCase()}</step>\n`;
      if (note.accidental === '#') {
        xml += `          <alter>1</alter>\n`;
      } else if (note.accidental === 'b') {
        xml += `          <alter>-1</alter>\n`;
      }
      xml += `          <octave>${note.octave}</octave>\n`;
      xml += `        </pitch>\n`;
    }

    const durStr = overrideDuration || note.duration;
    const durationVal = this.parseDuration(durStr);
    xml += `        <duration>${durationVal}</duration>\n`;
    
    const type = this.getNoteType(durStr);
    if (type) {
      xml += `        <type>${type}</type>\n`;
    }
    
    if (durStr.includes('.')) {
      xml += `        <dot/>\n`;
    }

    xml += `      </note>\n`;
    return xml;
  }

  private parseDuration(durStr: string): number {
    // 24 divisions per quarter note
    let base = 4;
    let isDotted = false;
    
    if (durStr.includes('.')) {
      isDotted = true;
      base = parseInt(durStr.split('.')[0], 10);
    } else {
      base = parseInt(durStr, 10);
    }

    let duration = (4 / base) * 24;
    if (isDotted) {
      duration *= 1.5;
    }
    
    return Math.round(duration);
  }

  private getNoteType(durStr: string): string {
    const base = parseInt(durStr.split('.')[0], 10);
    switch (base) {
      case 1: return 'whole';
      case 2: return 'half';
      case 4: return 'quarter';
      case 8: return 'eighth';
      case 16: return '16th';
      case 32: return '32nd';
      default: return '';
    }
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
