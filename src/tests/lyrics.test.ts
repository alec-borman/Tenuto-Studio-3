import { describe, it, expect } from 'vitest';
import { SVGEngraver } from '../engraver/svg';
import { Parser } from '../compiler/parser';

describe('TEAS: The Lyric Engine (Syllabification & Spanners)', () => {
  it('Task 1B: Dynamic Hyphenation - generates multiple equidistant hyphens when measure is stretched', () => {
    const code = `tenuto "3.0" {
meta @{ title: "Lyrics Test", tempo: 120, time: "4/4" }
def v1 "Voice 1" style=standard patch=gm_piano
measure 1 {
  v1: c4:4_"Hal-" d_"le-" e_"lu-" f_"jah"
}
measure 2 { v1: c4:4 d e f }
measure 3 { v1: c4:4 d e f }
measure 4 { v1: c4:4 d e f }
measure 5 { v1: c4:4 d e f }
measure 6 { v1: c4:4 d e f }
measure 7 { v1: c4:4 d e f }
measure 8 { v1: c4:4 d e f }
measure 9 { v1: c4:4 d e f }
measure 10 { v1: c4:4 d e f }
}`;
    const parser = new Parser(code);
    const ast = parser.parse();
    
    const engraver = new SVGEngraver({ systemWidth: 2000, spacingConstant: 200 });
    // Render with a very wide layout width to force stretching
    const { svgs } = engraver.render(ast);
    const svg = svgs[0];
    
    // We expect multiple hyphens to be generated between syllables when stretched
    // Since we don't have the exact implementation details of how hyphens are rendered in SVG,
    // we can check if there are multiple text elements containing hyphens.
    
    // Count the number of hyphen text elements
    const hyphenMatches = svg.match(/<text[^>]*>-<\/text>/g) || [];
    
    // With 4 syllables, there are 3 gaps. If stretched to 1000px, each gap should have multiple hyphens.
    // So we expect more than 3 hyphens in total.
    expect(hyphenMatches.length).toBeGreaterThan(3);
  });
});
