# Changelog
All notable changes to this project will be documented in this file.
The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [v3.0.0-alpha] - 2026-04-12
### Added
* **FFI WebAssembly Bridge Stabilization:** Eradicated the `E0000` null-reference crash by correctly unwrapping the composite Rust AST payload (`parsedPayload.ast`) across the FFI boundary.
* **The Protagonist Shift (IR Teleportation):** Executed TDB-FFI-041 to permanently deprecate the legacy TypeScript `AudioEventGenerator`. The Tone.js WebAudio engine and WebGL `render-worker` are now driven directly by the mathematically perfect Rust Intermediate Representation (IR) timeline.
* **Concrete Audio (`style=concrete`):** Integrated raw audio buffer mapping to alphanumeric keys with native granular slicing (`.slice`) and phase-vocoder time-stretching (`.stretch`).
* **Sidechain Ducking:** Added parsing for the spacer token (`s`) to generate invisible CC automation lanes for pure, automatable volume shaping without external DAW routing graphs.
* **MusicXML 4.0 Export:** Upgraded the XML emitter to correctly handle polyphonic voices via zero-duration `<forward>` and `<backup>` tags.
* **Rational Timeline:** Deterministic absolute time accumulation for drift-free audio.
* **Stateful Cursor:** Tracks octave, duration, and velocity per voice to massively reduce context token count.
* **Euclidean Rhythms:** Native algorithmic beat generation executing Bresenham line-drawing within tuplet brackets.

### Fixed
* **Asset Loader Hardening:** Hardened the audio asset loader to inject safe default Soundfont patches (`gm_synth`, `gm_drums`, `gm_piano`) when tracks omit the `patch` attribute, mathematically bypassing 60-second 404 network timeouts.
* **Infrastructure Wasm Parity:** Purged legacy `@vite-ignore` hacks and restored strict static imports to `src/pkg/tenutoc.js` to ensure the dev server accurately bundles the latest Wasm build.
