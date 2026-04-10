const fs=require('fs');
let p=fs.readFileSync('tenutoc/src/parser.rs','utf8');
p=p.split('args.join(",")').join('args.join("")');
fs.writeFileSync('tenutoc/src/parser.rs',p);

let x=fs.readFileSync('tenutoc/src/export/musicxml.rs','utf8');
if(!x.includes('<duration>0</duration>')){
  x=x.replace(/if current_tick < measure_end\s*\{\s*let dur = measure_end - current_tick;\s*xml\.push_str\("\s*<forward>\\n"\);\s*xml\.push_str\(&format!\("\s*<duration>\{\}<\/duration>\\n",\s*dur\)\);\s*xml\.push_str\("\s*<\/forward>\\n"\);\s*\}/g,
  'if current_tick < measure_end { let dur = measure_end - current_tick; xml.push_str(" <forward>\\n"); xml.push_str(&format!(" <duration>{}</duration>\\n", dur)); xml.push_str(" </forward>\\n"); } else { xml.push_str(" <forward>\\n"); xml.push_str(" <duration>0</duration>\\n"); xml.push_str(" </forward>\\n"); }');
  fs.writeFileSync('tenutoc/src/export/musicxml.rs',x);
}
