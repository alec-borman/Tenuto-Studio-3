import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('Infrastructure: IR Teleportation Handover', () => {
    it('verifies the TypeScript worker bypasses the legacy generator and maps the Rust IR directly', () => {
        const worker = readFileSync('src/compiler.worker.ts', 'utf8');
        expect(worker).toContain('parsedPayload.events.map');
        expect(worker).toContain('logical_time.num');
        expect(worker).toContain('logical_time.den');
        expect(worker).toContain('pitch_midi');
        expect(worker).not.toContain('audioGen.generate');
    });
});
