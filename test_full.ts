import { Parser } from './src/compiler/parser.js';
import { Lexer } from './src/compiler/lexer.js';
import * as fs from 'fs';

const code = fs.readFileSync('test.tenuto', 'utf-8');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
try {
  const ast = parser.parse();
  console.log("Success!");
} catch (e) {
  console.error(e);
}
