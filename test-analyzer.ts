import { readFileSync } from 'fs';
import { Parser } from './src/compiler/parser';
import { SemanticAnalyzer } from './src/compiler/analyzer';

const code = readFileSync('test.tenuto', 'utf-8');
const parser = new Parser(code);
const ast = parser.parse();
const analyzer = new SemanticAnalyzer(ast);
const errors = analyzer.analyze();
console.log(errors);
