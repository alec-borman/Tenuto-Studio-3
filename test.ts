import { readFileSync } from 'fs';
import { Lexer } from './src/compiler/lexer';
import { Parser } from './src/compiler/parser';
import { SemanticAnalyzer } from './src/compiler/analyzer';

const code = readFileSync('test2.tenuto', 'utf-8');
try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  // console.log(tokens);
  const parser = new Parser(code);
  const ast = parser.parse();
  console.log(JSON.stringify(ast.measures[5], null, 2));
  const analyzer = new SemanticAnalyzer(ast);
  const score = analyzer.analyze();
  console.log(score.map(e => e.message));
} catch (e) {
  console.error(e);
}
