import { Lexer } from './src/compiler/lexer';

const code = '4grace';
const lexer = new Lexer(code);
console.log(lexer.tokenize());
