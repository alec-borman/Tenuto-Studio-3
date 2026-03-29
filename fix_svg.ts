import * as fs from 'fs';

let content = fs.readFileSync('tenutoc/src/engrave/svg.rs', 'utf8');

// Replace \\" with \"
content = content.replace(/\\\\"/g, '\\"');
// Replace \" with "
content = content.replace(/\\"/g, '"');

fs.writeFileSync('tenutoc/src/engrave/svg.rs', content);
console.log('Fixed svg.rs');
