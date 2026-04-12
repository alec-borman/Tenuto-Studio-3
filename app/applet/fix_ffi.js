import fs from 'fs';

let worker = fs.readFileSync('src/compiler.worker.ts', 'utf8');
worker = worker.replace('wasmAst = JSON.parse(wasmIrString);', 'const parsedPayload = JSON.parse(wasmIrString);\n                    wasmAst = parsedPayload.ast;');
fs.writeFileSync('src/compiler.worker.ts', worker);

console.log('FFI payload unwrapping applied.');
