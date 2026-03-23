<div align="center">
  <h1>Tenuto Studio 3.0</h1>
  <p><b>The Definitive System of Record for Music</b></p>
  <p><i>A CRM, but for Musical Intent</i></p>
  <br/>
</div>

---

## 🎵 One Source of Truth for Your Musical Ideas

What if you could capture every nuance of a musical composition—the pitches, rhythms, articulations, lyrics, micro‑timing, synthesizer envelopes, sample slices, and even the routing of effects—in a single, human‑readable text file? What if that same file could be instantly rendered as a beautifully engraved score, a perfectly quantized MIDI performance, a full‑fidelity audio mix, and a live‑coding session synchronized with Ableton Link?

**Tenuto is that file.** It is a deterministic, declarative domain‑specific language that acts as the **system of record** for musical intent. Like a Customer Relationship Management (CRM) system consolidates all client interactions, Tenuto consolidates every aspect of a musical work—from the ink on the page to the electricity in the speakers—into a single, version‑controllable, AI‑friendly format.

---

## 🧠 Philosophy: Strict Decoupling

Tenuto Studio 3.0 is built on a philosophy of **strict decoupling** between the compiler (`tenutoc`) and the physics layer (the audio engine).

*   **The Compiler (`tenutoc`)**: Operates as a pure function. Written in Rust and compiled to WebAssembly, it takes a Tenuto source string and deterministically outputs an Abstract Syntax Tree (AST) and a linear timeline of events. It has no concept of audio, DOM, or time.
*   **The Physics Layer (Audio Engine)**: A highly optimized, zero-allocation WebAudio engine that acts purely as a consumer of the compiler's output. It never assumes the internal state of the compiler, ensuring memory safety and immutability.

This black-box mindset guarantees that the language can be ported to any environment (browser, native, server) without dragging along a monolithic audio engine.

---

## 🏗️ Architecture: Zero-Allocation DSP

The Tenuto 3.0 audio engine is engineered for uncompromising performance and stability, utilizing cutting-edge web technologies:

*   **Wasm Compilation**: The core language parser and compiler are written in Rust and compiled to WebAssembly (`wasm32-unknown-unknown`), providing near-native execution speed for complex macro expansions and tuplet math.
*   **SharedArrayBuffer & Atomics**: The main thread and the `AudioWorklet` communicate via a lock-free Ring Buffer backed by a `SharedArrayBuffer`. The main thread serializes audio events into binary float data, and the worklet reads them using `Atomics` for deterministic, thread-safe synchronization.
*   **Zero-Allocation Object Pool**: The `AudioWorklet` pre-allocates a fixed pool of `Voice` and `Automation` objects during initialization. During playback, it exclusively recycles these objects via an `.init()` method. The `new` keyword is never used in the audio thread, completely eliminating Garbage Collection (GC) pauses and ensuring sample-accurate timing.

---

## 💻 Language in Action

Tenuto 3.0 introduces stateful cursor logic and dot-chained attributes for precise control over musical articulation and expression.

```tenuto
tenuto "3.0" {
  meta @{ title: "Olympia", tempo: 120, time: "4/4" }
  
  def synth1 "Lead Synth" style=synth env=@{ a: 10ms, d: 200ms, s: 50%, r: 500ms }
  def fxTrack "FX Return" style=concrete src="bus://synth1" env=@{ a: 10ms, d: 1s, s: 100%, r: 1s }
  
  measure 1 {
    |:
    synth1: c5:8.stacc d5:8.stacc e5:8.stacc f5:8.stacc g5:8.stacc f5:8.stacc e5:8.stacc d5:8.stacc |
    fxTrack: c4:1.slice(2).reverse |
    :|
  }
}
```

---

## 🚀 Quick Start

The Tenuto Studio 3.0 core consists of a Rust-based compiler (`tenutoc`) compiled to WebAssembly, and a TypeScript frontend.

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18+)
*   [Rust](https://www.rust-lang.org/tools/install)
*   [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

### 1. Build the Rust Compiler (Wasm)
Compile the Rust core into WebAssembly for the browser:
```bash
npm run build:wasm
```
*(This runs `cd tenutoc && wasm-pack build --target web --out-dir ../public/pkg`)*

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Start the Development Server
Run the Vite dev server (which also builds the Wasm automatically):
```bash
npm run dev:all
```

---

## 📚 Documentation

*   **API Documentation:** Generated via TypeDoc. See the `docs/api` directory (generated during build).
*   **Manual Documentation:** Comprehensive guides and language specifications are available in the `/docs` folder.
