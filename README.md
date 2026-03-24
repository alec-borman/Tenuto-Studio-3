<div align="center">
  <h1>Tenuto Studio 3.0</h1>
  <p><b>The Definitive System of Record for Music</b></p>
  <p><i>A CRM, but for Musical Intent</i></p>
  <br/>
</div>

---

## 🎵 The Vision: System of Record for Music

What if you could capture every nuance of a musical composition—the pitches, rhythms, articulations, lyrics, micro‑timing, synthesizer envelopes, sample slices, and even the routing of effects—in a single, human‑readable text file? What if that same file could be instantly rendered as a beautifully engraved score, a perfectly quantized MIDI performance, a full‑fidelity audio mix, and a live‑coding session synchronized with Ableton Link?

**Tenuto is that file.** It is a deterministic, declarative domain‑specific language that acts as the **system of record** for musical intent. Like a Customer Relationship Management (CRM) system consolidates all client interactions, Tenuto consolidates every aspect of a musical work—from the ink on the page to the electricity in the speakers—into a single, version‑controllable, AI‑friendly format.

### The "Narrow Waist" Philosophy
Tenuto Studio 3.0 is built on a philosophy of **strict decoupling** between the pure-function compiler and the physics/rendering layers. 
*   **The Compiler**: Operates as a pure function, taking a Tenuto source string and deterministically outputting an Abstract Syntax Tree (AST) and a linear timeline of events (Intermediate Representation). It has no concept of audio, DOM, or time.
*   **The Physics & Rendering Layers**: The AudioWorklet engine, TEAS SVG Engraver, and external OSC daemons act purely as consumers of the compiler's output. They never assume the internal state of the compiler, ensuring memory safety, immutability, and infinite portability.

---

## 🏗️ Current State: The Iterative Hybrid Architecture

We are currently in an active, pragmatic, and highly iterative development phase. To achieve rapid iteration, hot-reloading, and instantaneous UI feedback during this MVP phase, we are employing a **Hybrid Architecture**:

*   **TypeScript Scaffolding:** Currently, the TypeScript frontend handles the heavy lifting of AST parsing and semantic analysis. This is intentional *scaffolding* that allows us to rapidly prototype language features, test grammar changes, and immediately visualize the results in the browser.
*   **Rust Core (`tenutoc`):** The Rust core (compiled to WebAssembly) is already handling massive-scale tasks like zero-copy MIDI decompilation (via reverse Bresenham/LZ77 macro extraction) and acts as our robust fallback compiler.
*   **Live AudioWorklet Engine:** The physics layer is fully operational. The AudioWorklet engine utilizes a zero-allocation object pool and a `SharedArrayBuffer` ring buffer to achieve glitch-free, phase-locked execution, completely eliminating Garbage Collection (GC) pauses.

---

## 🗺️ The Roadmap: Turning Scaffolding into Steel

As we transition from our current beta to the final 3.0 release, we are systematically replacing our rapid-prototyping scaffolding with enterprise-grade infrastructure:

*   **Phase 1: The Rust Port:** Migrating the finalized TypeScript LL(1) parser and semantic analyzer entirely into the Rust `tenutoc` crate using `logos` and `chumsky`. This will establish Rust as the absolute single source of truth for the Tenuto language, maximizing performance and safety.
*   **Phase 2: TEAS Engraver Polish:** Expanding the layout engine to support compound time signatures, advanced SMuFL glyphs (clefs, key signatures, dynamics), and cross-measure structural repeats for commercial-grade sheet music rendering.
*   **Phase 3: Daemon Orchestration:** Hardening the `tenutod` Rust daemon for UDP/OSC delegation and Ableton Link synchronization, enabling seamless live algorithmic performances and hardware integration.

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
