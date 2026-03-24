<div align="center">
  <h1>Tenuto Studio 3.0: The Semantic Conductor</h1>
  <p><b>The Definitive System of Record for Music</b></p>
  <p><i>A CRM, but for Musical Intent</i></p>
  <br/>
</div>

---

## 🎵 The Vision: System of Record for Music

What if you could capture every nuance of a musical composition—the pitches, rhythms, articulations, lyrics, micro‑timing, synthesizer envelopes, sample slices, and even the routing of effects—in a single, human‑readable text file? What if that same file could be instantly rendered as a beautifully engraved score, a perfectly quantized MIDI performance, a full‑fidelity audio mix, and a live‑coding session synchronized with Ableton Link?

**Tenuto is that file.** It is a deterministic, declarative domain‑specific language that acts as the **system of record** for musical intent. It unifies the discrete logic of classical notation with the continuous physics of modern DSP into a single, human-readable "Narrow Waist" protocol. Like a Customer Relationship Management (CRM) system consolidates all client interactions, Tenuto consolidates every aspect of a musical work—from the ink on the page to the electricity in the speakers—into a single, version‑controllable, AI‑friendly format.

### The "Narrow Waist" Philosophy
Tenuto Studio 3.0 is built on a philosophy of **strict decoupling** between the pure-function compiler and the physics/rendering layers. 
*   **The Compiler**: Operates as a pure function, taking a Tenuto source string and deterministically outputting an Abstract Syntax Tree (AST) and a linear timeline of events (Intermediate Representation). It has no concept of audio, DOM, or time.
*   **The Physics & Rendering Layers**: The AudioWorklet engine, TEAS SVG Engraver, and external OSC daemons act purely as consumers of the compiler's output. They never assume the internal state of the compiler, ensuring memory safety, immutability, and infinite portability.

### 🏗️ The Ecosystem Architecture
- **tenutoc (The Brain):** A pure-function Rust compiler (wasm32) that transforms Tenuto source into a mathematical Intermediate Representation (IR).
- **Tenuto Web Studio (The Interface):** A high-performance IDE utilizing Monaco, WebGL-accelerated visualization, and a zero-allocation WebAudio engine.
- **tenutod (The Muscle):** A Rust-based daemon for real-time hardware orchestration, sACN theatrical lighting, and Ableton Link synchronization.
- **TEAS Engraver (The Ink):** A professional-grade SVG layout engine utilizing spring-rod models and Elaine Gould’s engraving standards.

---

## 🧠 Intelligence Layer: Addendum I (RAG)

To maintain a 10x development velocity as the codebase scales to 50k+ lines, Tenuto 3.0 implements **Retrieval-Augmented Generation (RAG)**:

- **Semantic Indexing:** AST-aware chunking via Tree-sitter ensures logical blocks (Rust impls/TS classes) remain intact.
- **Vector Orchestration:** Local LanceDB indexing allows for surgical retrieval of "Narrow Waist" logic, bypassing peripheral UI noise.
- **Domain Tagging:** Every vector is tagged by architectural domain (`compiler`, `audio`, `visual`, `infra`), ensuring the AI collaborator remains focused on the relevant layer.

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
*   **Phase 4: Intelligent Infrastructure:** Implement the `tenuto-indexer` CLI for AST-aware LanceDB generation, and hard-wire the gPTP Grandmaster clock in `tenutod` for microsecond-accurate theatrical execution.

---

## 🚀 Deployment & Sovereignty: Cloudflare Pages + R2 Strategy

Tenuto Studio 3.0 is designed for **Zero-Cost, High-Fidelity Distribution**:

*   **Hosting:** Distributed via Cloudflare Pages with native COOP/COEP headers to unlock `SharedArrayBuffer` multithreading.
*   **Assets:** Large-scale acoustic samples are served from Cloudflare R2 with explicit CORP headers for security-perimeter penetration.
*   **Sovereignty:** 100% client-side execution via Wasm; no server-side "Gatekeepers" required for compilation or rendering.

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

### 🚀 Advanced Development Setup

Tenuto Studio 3.0 is a polyglot monorepo. Follow the steps below based on your operating system.

#### 1\. General Prerequisites

Regardless of OS, you must have the following installed:

  * **Node.js** (v18+ LTS)
  * **Rust** (Stable) via [rustup.rs](https://rustup.rs)
  * **wasm-pack**: `cargo install wasm-pack`

-----

#### 2\. Windows (PowerShell) Build Flow

**1. Install Build Tools:** Ensure "Desktop development with C++" is installed via [Visual Studio Installer](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
**2. Set Execution Policy:** If `wasm-pack` is blocked, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
**3. Compile the Wasm Core (`tenutoc`):**
```powershell
cd tenutoc
wasm-pack build --target web --out-dir ../public/pkg
cd ..
```
**4. Start the Native Daemon (`tenutod`):** Open a new terminal and run:
```powershell
cd tenutod
cargo run
```
**5. Launch the Web Studio:** In your original terminal, install dependencies and start the dev server:
```powershell
npm install
npm run dev -- --force
```

-----

#### 3\. Linux (Ubuntu/Debian) Build Flow

**1. Install System Dependencies:**
```bash
sudo apt update && sudo apt install build-essential pkg-config libssl-dev
```
**2. Add Wasm Target:**
```bash
rustup target add wasm32-unknown-unknown
```
**3. Compile the Wasm Core (`tenutoc`):**
```bash
cd tenutoc
wasm-pack build --target web --out-dir ../public/pkg
cd ..
```
**4. Start the Native Daemon (`tenutod`):** Open a new terminal and run:
```bash
cd tenutod
cargo run
```
**5. Launch the Web Studio:** In your original terminal, install dependencies and start the dev server:
```bash
npm install
npm run dev -- --force
```

-----

#### 4\. macOS (Homebrew) Build Flow

**1. Install Build Tools & Dependencies:**
```bash
xcode-select --install
brew install nodejs wasm-pack
```
**2. Compile the Wasm Core (`tenutoc`):**
```bash
cd tenutoc
wasm-pack build --target web --out-dir ../public/pkg
cd ..
```
**3. Start the Native Daemon (`tenutod`):** Open a new terminal and run:
```bash
cd tenutod
cargo run
```
**4. Launch the Web Studio:** In your original terminal, install dependencies and start the dev server:
```bash
npm install
npm run dev -- --force
```

-----

### 🧪 Troubleshooting the Build

  * **`tenutoc.js` not found:** This means Step A failed or was skipped. Ensure the `public/pkg` folder contains the `.wasm` and `.js` files.
  * **WebSocket Errors:** Ensure the Native Daemon (`tenutod`) is actually running on port `8080`.
  * **MIME Type (Wasm):** If the browser refuses to load the Wasm, ensure you are using the Vite dev server and not opening the `index.html` file directly.

---

## 📚 Documentation

*   **API Documentation:** Generated via TypeDoc. See the `docs/api` directory (generated during build).
*   **Manual Documentation:** Comprehensive guides and language specifications are available in the `/docs` folder.
