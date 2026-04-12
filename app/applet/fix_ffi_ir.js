import fs from 'fs';

let worker = fs.readFileSync('src/compiler.worker.ts', 'utf8');

const oldAudioGen = `            // Generate audio events directly from AST
            const audioGen = new AudioEventGenerator();
            const audioEvents = audioGen.generate(wasmAst);`;

const newAudioGen = `            const audioEvents = parsedPayload.events.map((node: any) => {
                let pitch_midi = 0;
                let velocity = 0;
                if (node.kind && node.kind.Note) {
                    pitch_midi = node.kind.Note.pitch_midi || 0;
                    velocity = node.kind.Note.velocity || 0;
                }
                return {
                    time: (node.logical_time.num / node.logical_time.den) * 4,
                    duration: (node.logical_duration.num / node.logical_duration.den) * 4,
                    instrument: node.track_id,
                    style: node.track_style,
                    patch: node.track_patch,
                    note: pitch_midi,
                    midi: pitch_midi,
                    velocity: velocity
                };
            });`;

if (worker.includes(oldAudioGen)) {
    worker = worker.replace(oldAudioGen, newAudioGen);
    fs.writeFileSync('src/compiler.worker.ts', worker);
}

console.log('FFI IR Handover applied.');
