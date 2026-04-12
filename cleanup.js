import fs from 'fs';

const filesToDelete = [
    'test_parity_ast.spec.ts',
    'test_parity_physics.spec.ts',
    'test_parity_visual.spec.ts',
    'test_semantics_034.spec.ts',
    'test_semantics_035.spec.ts',
    'test_semantics_outer.spec.ts',
    'test_parser_override.spec.ts',
    'test_topology.spec.ts',
    'test_app_restore.spec.ts',
    'test_env_parser.spec.ts',
    'fix_ast.js',
    'fix_ast.cjs',
    'fix_physics.js',
    'fix_physics.cjs',
    'fix_semantics.js',
    'fix_semantics_034.js',
    'fix_semantics_035.js',
    'fix_visuals.js',
    'fix_parser.js',
    'apply_fix.js',
    'fix.js'
];

for (const file of filesToDelete) {
    try {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`Deleted ${file}`);
        }
    } catch (e) {
        console.error(`Failed to delete ${file}: ${e.message}`);
    }
}
