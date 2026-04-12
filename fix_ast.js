import fs from 'fs';

function fixAst() {
    const filePath = 'tenutoc/src/parser.rs';
    let code = fs.readFileSync(filePath, 'utf8');

    const oldDefBuilder = `            let mut style = "default".to_string();
            let mut src = None;
            for (k, v) in kvs {
                if k == "style" { style = v.clone(); }
                if k == "src" { src = Some(v.clone()); }
            }
            Definition {
                id,
                name: name.unwrap_or_default(),
                style,
                patch: "".to_string(),
                group: None,
                env,
                src,
                tuning: None,
                map,
            }`;

    const newDefBuilder = `            let mut style = "default".to_string();
            let mut src = None;
            let mut patch = "".to_string();
            let mut group = None;
            let mut tuning = None;
            for (k, v) in kvs {
                if k == "style" { style = v.clone(); }
                if k == "src" { src = Some(v.clone()); }
                if k == "patch" { patch = v.clone(); }
                if k == "group" { group = Some(v.clone()); }
                if k == "tuning" { tuning = Some(v.clone()); }
            }
            Definition {
                id,
                name: name.unwrap_or_default(),
                style,
                patch,
                group,
                env,
                src,
                tuning,
                map,
            }`;

    if (code.includes(oldDefBuilder)) {
        code = code.replace(oldDefBuilder, newDefBuilder);
        fs.writeFileSync(filePath, code);
        console.log('AST completeness fix applied.');
    } else {
        console.log('Old definition builder not found or already fixed.');
    }
}

fixAst();