import { existsSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('Workspace Hygiene', () => {
    it('verifies all temporary Inner Gauntlet failsafe tests and surgical scripts are purged', () => {
        const filesToCheck = [
            'test_parity_ast.spec.ts',
            'test_parity_physics.spec.ts',
            'test_parity_visual.spec.ts',
            'test_semantics_034.spec.ts',
            'test_semantics_035.spec.ts',
            'test_semantics_outer.spec.ts',
            'test_parser_override.spec.ts',
            'fix_ast.js',
            'fix_physics.js',
            'fix_semantics.js',
            'fix_semantics_034.js',
            'fix_semantics_035.js',
            'fix_visuals.js'
        ];

        for (const file of filesToCheck) {
            expect(existsSync(file)).toBe(false, `File ${file} still exists and must be deleted.`);
        }
    });
});
