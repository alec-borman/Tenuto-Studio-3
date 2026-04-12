import fs from 'fs';

let worker = fs.readFileSync('src/compiler.worker.ts', 'utf8');
worker = worker.replace(/\/\/ @vite-ignore/g, '');
worker = worker.replace(/const wasmPath = .*/g, '');
worker = worker.replace(/compile_tenuto_to_ir_json/g, 'compile_tenuto_json');
fs.writeFileSync('src/compiler.worker.ts', worker);

let el = fs.readFileSync('src/tenuto-element.js', 'utf8');
el = el.replace(/\/\/ @vite-ignore/g, '');
el = el.replace(/const wasmPath = .*/g, '');
fs.writeFileSync('src/tenuto-element.js', el);

let pkg = fs.readFileSync('package.json', 'utf8');
pkg = pkg.replace(/\.\.\/public\/pkg/g, '../src/pkg');
fs.writeFileSync('package.json', pkg);

console.log('Infra fix applied.');
