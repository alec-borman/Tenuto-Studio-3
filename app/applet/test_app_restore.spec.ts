import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('App: Olympia Restore', () => {
    it('restores the env ADSR attributes to DEFAULT_CODE', () => {
        const app = readFileSync('src/App.tsx', 'utf8');
        expect(app).toContain('env=@{ a: 10ms, d: 200ms, s: 50%, r: 500ms }');
        expect(app).toContain('env=@{ a: 10ms, d: 1s, s: 100%, r: 1s }');
    });
});
