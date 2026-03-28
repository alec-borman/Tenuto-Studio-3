import { Parser } from '../compiler/parser';

const code = `tenuto "3.0" {
    measure 1 {
        v1: c4:4.fx("bitcrusher",@{bits:4,dryWet:0.8}).pan([-1.0,1.0],"exponential").roll(4)
    }
}`;
const parser = new Parser(code);
const ast = parser.parse();
console.log(JSON.stringify(ast, null, 2));
