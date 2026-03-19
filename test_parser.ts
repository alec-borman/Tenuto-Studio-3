import { Parser } from './src/compiler/parser.js';
import { Lexer } from './src/compiler/lexer.js';

const code = `tenuto "3.0" {
  meta @{
    title: "Dawn of the Logic Layer - Opus 1",
    composer: "AI Master Composer",
    tempo: 88,
    time: "4/4",
    key: "C",
    humanize: 0.05,
    auto_pad_voices: true
  }

  def rh "Right Hand" style=relative patch="gm_piano"
  def lh "Left Hand"  style=standard patch="gm_piano"

  measure 1-4 {
    rh: <[
      v1: r:2 | v2: r:2
    ]>
  }
}`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log(tokens);
const parser = new Parser(tokens);
try {
  const ast = parser.parse();
  console.log("Success:", JSON.stringify(ast, null, 2));
} catch (e) {
  console.error(e);
}
