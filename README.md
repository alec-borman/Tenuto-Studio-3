# 🎵 Tenuto 3.0: The System of Record for Music

What if you could capture every nuance of a musical composition—the pitches, rhythms, articulations, lyrics, micro-timing, synthesizer envelopes, sample slices, and even the routing of effects—in a single, human-readable text file?. What if that same file could be instantly rendered as a beautifully engraved score, a perfectly quantized MIDI performance, a full-fidelity audio mix, and a live-coding session synchronized with Ableton Link?.

**Tenuto is that file.** It is a deterministic, declarative domain-specific language designed to be the standard output format for AI music models, providing a transparent, editable, and versionable alternative to "Black Box" audio generation. It unifies the discrete logic of classical notation with the continuous physics of modern DSP into a single, human-readable "Narrow Waist" protocol. Like a Customer Relationship Management (CRM) system consolidates all client interactions, Tenuto consolidates every aspect of a musical work—from the ink on the page to the electricity in the speakers—into a single, version-controllable, AI-friendly format.

## 🚀 The Producer Update (v3.0)
Version 3.0 shatters the boundary between acoustic notation and electronic production:
* **Continuous Physics (`style=synth`):** Define global ADSR envelopes, LFOs, and execute continuous portamento glides (`.glide(150ms)`) directly from the text.
* **Concrete Sampling (`style=concrete`):** Map raw audio buffers to alphanumeric keys. Execute granular slicing (`.slice(8)`), time-stretching, and phase-vocoding natively.
* **Rational Timelines & Micro-Timing:** Tenuto evaluates all time using Rational Arithmetic (P/Q) to eliminate floating-point drift. Inject human "pocket" via absolute micro-timing modifiers (`.pull(15ms)`).
* **The Bi-Directional Projectional DAW:** Tenuto 3.0 introduces a revolutionary DAW interface. The GUI possesses no hidden state; dragging a block visually executes a deterministic text-mutation algorithm on the underlying `.ten` source code.

## 🌐 The Zero-Friction WebAssembly Runtime
Tenuto 3.0 is designed for the web. The core Rust compiler (`tenutoc`) compiles to `wasm32-unknown-unknown`, allowing you to embed procedural music directly into any web page with zero external dependencies.

## 🧠 AI Orchestration & LanceDB RAG
As your symphony scales to 50,000+ lines of code, Tenuto scales with you. The ecosystem includes an AST-Aware Semantic Indexer powered by **LanceDB**. This allows AI collaborators to execute surgical, Retrieval-Augmented Generation (RAG) queries against your codebase, understanding the "Musical Intent" without hallucinating syntax.

---

## 🛠️ Getting Started: How to Run Tenuto Studio 3.0
Tenuto Studio runs locally as a Vite + React application, powered by a Rust WebAssembly compiler. 

### Prerequisites (All Platforms)
1. **Node.js** (v18 or higher)
2. **Rust & Cargo** (latest stable)
3. **wasm-pack** (Install via `npm install -g wasm-pack` or `cargo install wasm-pack`)

### Platform-Specific Setup
**🍎 macOS / 🪟 Windows / 🐧 Linux**
For all three operating systems, the installation and execution steps utilizing the cross-platform Node and Cargo toolchains are identical:
1. Clone the repository and navigate to the project root.
2. Install dependencies: `npm install`
3. Build the Wasm compiler: `wasm-pack build ./tenutoc --target web`
4. Start the dev server: `npm run dev`
5. Once running, open `http://localhost:3000` in your browser.

### 🎹 Usage Instructions
1. **Write Intent:** Use the left-hand Monaco editor to write declarative Tenuto code (e.g., `tenuto "3.0" { ... }`).
2. **Compile:** The code is automatically sent across the FFI boundary to the Rust Wasm compiler (`tenutoc`).
3. **Play:** Click the "Play" button to render the JSON Intermediate Representation (IR) through the browser's WebAudio API (Tone.js/smplr).
4. **Export:** Download the generated MIDI 1.0 file or view the raw AST/IR payloads.

---

## ⚡ Current Capabilities vs. Limitations
**What you CAN do right now:**
* Write and parse strict LL(1) Tenuto 3.0 grammar.
* Compile Tenuto code deterministically into a 1024-dimension IR.
* Emit perfect MIDI 1.0 files with Rational-to-Tick time conversion.
* Emit JSON payloads for WebAudio playback.
* Embed the `<tenuto-score>` Web Component in any vanilla HTML page.

**What you CAN'T do (Yet):**
* **Full SVG Engraving:** The visual sheet music rendering is currently a placeholder.
* **Advanced DSP Rendering:** While `.slice(8)` and `.glide(150ms)` are parsed and embedded into the IR, the frontend WebAudio engine does not yet fully render granular synthesis or phase-vocoding.
* **Decompilation:** Converting raw MIDI files *back* into semantic Tenuto code is currently stubbed.

---

## 🌍 Portability & Cross-Device Execution
Tenuto Studio is designed under the **Local-First Covenant**. Because the core compiler (`tenutoc`) is written in memory-safe Rust and targets `wasm32-unknown-unknown`, it is inherently portable to almost any device:
* **Mobile & Tablets (iOS/Android):** The `<tenuto-score>` Web Component runs natively in mobile browsers (Safari/Chrome) without modification.
* **Native Apps:** The Wasm binary can be embedded directly into iOS (via JavaScriptCore) or Android (via V8) apps, bypassing the DOM entirely.
* **Edge Runtimes:** `tenutoc` can run on Cloudflare Workers or Deno Deploy for serverless compilation.
* **Embedded Hardware:** Using runtimes like Wasmtime or WasmEdge, the Tenuto compiler can be ported to Raspberry Pi, digital synthesizers, or Eurorack modules, allowing hardware to natively understand Tenuto code.

---

## ⚠️ PRIVATE PROTOCOL DISCLAIMER (The Skybridge)
The Tenuto language, compiler (`tenutoc`), and studio interface are open-source. However, Tenuto is architected using the **Teleportation Protocol (.tela)**—an internal, proprietary AI-collaboration framework. While you may see references to 1024-dimensional "intent vectors" in the core compiler logic, the `.tela` protocol, its embedding engine (`telac`), and the associated vector-based development tooling are currently **private** and are **not part of this open-source repository**. They are decoupled via the Skybridge, ensuring community contributors can write standard Rust and TypeScript without interacting with the meta-physics engine.

***

