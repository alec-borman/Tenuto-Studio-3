<div align="center">
  <h1>Tenuto Studio 3.0: The Semantic Conductor</h1>
  <p><b>The Definitive System of Record for Music</b></p>
  <p><i>A CRM, but for Musical Intent</i></p>
  <br/>
</div>

---

## 🎵 The Vision: System of Record for Music

What if you could capture every nuance of a musical composition—the pitches, rhythms, articulations, lyrics, micro‑timing, synthesizer envelopes, sample slices, and even the routing of effects—in a single, human‑readable text file? What if that same file could be instantly rendered as a beautifully engraved score, a perfectly quantized MIDI performance, a full‑fidelity audio mix, and a live‑coding session synchronized with Ableton Link?

**Tenuto is that file.** It is a deterministic, declarative domain‑specific language designed to be the **standard output format for AI music models**, providing a transparent, editable, and versionable alternative to "Black Box" audio generation. It unifies the discrete logic of classical notation with the continuous physics of modern DSP into a single, human-readable "Narrow Waist" protocol. Like a Customer Relationship Management (CRM) system consolidates all client interactions, Tenuto consolidates every aspect of a musical work—from the ink on the page to the electricity in the speakers—into a single, version‑controllable, AI‑friendly format.

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

To maintain a 10x development velocity as the codebase scales to 50k+ lines, Tenuto 3.0 implements **Retrieval-Augmented Generation (RAG)**. The local LanceDB indexer is now **LIVE**.

- **Semantic Indexing:** AST-aware chunking via Tree-sitter ensures logical blocks (Rust impls/TS classes) remain intact.
- **Vector Orchestration:** Local LanceDB indexing allows for surgical retrieval of "Narrow Waist" logic, bypassing peripheral UI noise.
- **Domain Tagging:** Every vector is tagged by architectural domain (`compiler`, `audio`, `visual`, `infra`), ensuring the AI collaborator remains focused on the relevant layer.

### Using the Semantic Console

**Note:** A valid `GEMINI_API_KEY` must be present in the `.env` file in the root directory for these scripts to function.

```bash
# To map the current codebase to the vector database:
npm run index

# To search the database for context before writing new code:
npm run search "How does the AudioEventGenerator handle roll modifiers?"
```

### The Corpus Builder (Decompiling MIDI)

To unlock decades of existing music and solve the "Blank Page" problem, Tenuto 3.0 includes a standalone Semantic Decompiler CLI. This implements the Reverse Inference Heuristics defined in Addendum D of the Language Specification.

You can convert standard MIDI files into idiomatic Tenuto 3.0 code (`.ten` files) using the following command:

```bash
npm run decompile <input.mid> <output.ten>
```

---

## 🏗️ Current State: The Iterative Hybrid Architecture

We are currently in an active, pragmatic, and highly iterative development phase. To achieve rapid iteration, hot-reloading, and instantaneous UI feedback during this MVP phase, we are employing a **Hybrid Architecture** governed by the **Dual-Track Mandate**:

*   **TypeScript Scaffolding (Live Web Preview):** Currently, the TypeScript frontend handles the heavy lifting of AST parsing and semantic analysis for the web preview. This is intentional *scaffolding* that allows us to rapidly prototype language features, test grammar changes, and immediately visualize the results in the browser.
*   **Rust Core (`tenutoc`) (The Steel):** The high-performance Rust core (compiled to WebAssembly) acts as our robust engine for the "Pro" desktop build and handles massive-scale tasks. It is the absolute single source of truth for the Tenuto language.
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

### Embedding Tenuto Scores (Web Component)

You can easily embed interactive Tenuto scores on any webpage using the framework-agnostic `<tenuto-score>` Web Component. This encapsulates the compiler, SVG engraver, and Audio engine into a single HTML tag.

```html
<!-- Import the component bundle -->
<script type="module" src="https://your-domain.com/tenuto-score.js"></script>

<!-- Embed the score -->
<tenuto-score src="https://your-domain.com/scores/my-song.tenuto"></tenuto-score>
```

---

## 💻 Language in Action

Tenuto 3.0 introduces stateful cursor logic, dot-chained attributes, and powerful DSP effects routing for precise control over musical articulation and expression. It also supports Euclidean rhythms (`hits`, `steps`) and the `.roll()` sub-tick engine.

```tenuto
tenuto "3.0" {
  meta @{ title: "Olympia", tempo: 120, time: "4/4" }
  
  def synth1 "Lead Synth" style=synth env=@{ a: 10ms, d: 200ms, s: 50%, r: 500ms }
  def fxTrack "FX Return" style=concrete src="bus://synth1" env=@{ a: 10ms, d: 1s, s: 100%, r: 1s }
  
  measure 1 {
    |:
    synth1: c5:8.stacc.fx("bitcrusher", @{bits: 4}) d5:8.stacc.fx("delay", @{time: 250, feedback: 0.4}) e5:8.stacc.fx("reverb", @{decay: 3}) f5:8.stacc.fx("distortion", @{amount: 0.8}) g5:8.stacc.fx("chorus", @{speed: 2.0}) f5:8.stacc e5:8.stacc d5:8.stacc |
    fxTrack: c4:1.slice(2).reverse.roll(32) |
    :|
  }
}
```

### Available Effects
The AudioEngine now supports professional-grade DSP effects powered by Tone.js:
- **reverb**: `fx("reverb", @{decay: 4, dryWet: 0.5})`
- **delay**: `fx("delay", @{time: 250, feedback: 0.3, dryWet: 0.5})`
- **distortion**: `fx("distortion", @{amount: 0.5, dryWet: 0.5})`
- **bitcrusher**: `fx("bitcrusher", @{bits: 4, dryWet: 0.5})`
- **chorus**: `fx("chorus", @{speed: 1.5, delay: 3.5, depth: 0.7, dryWet: 0.5})`

---

## 🤖 The AI Bridge: From Intent to Infrastructure

Because Tenuto is a text-based DSL, it is natively "fluent" in LLM (Large Language Model) contexts. Unlike a DAW binary file, an AI can read, write, and refactor Tenuto code to perform complex musical tasks that would take dozens of clicks in a traditional GUI. This enables a true "Zero-Skill" workflow where producers can focus on intent rather than infrastructure.

### Producer Interaction Example

**Prompt:** *"Give me a dark, aggressive 808 bassline. Make it stutter at the end of every 4 bars and add a lo-fi grit that fades in."*

**Tenuto Output:**
```tenuto
// AI-Generated dark aggressive bass structure
def bass "808" style=synth env=@{ a: 10ms, d: 500ms }

measure 1-3 {
  // Euclidean (3,8) rhythm provides the syncopated 'drive'
  bass: c2:4(3,8) | 
}

measure 4 {
  // .roll(32) creates the stutter, .fx automates the grit
  bass: c2:2 c2:2.roll(32).fx("bitcrusher", @{bits: 4, dryWet: [0.0, 1.0]})
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
*   
## 👤 Creator & Maintainer

Tenuto Studio 3 was created by **Alec Borman** – a systems architect, Rust/Wasm engineer, and author of *The Resonance of Tuesday*. It is the reference implementation of the Tenuto music notation language, designed to bring deterministic, archival‑first principles to music composition.

Building on the same philosophy of sovereign, declarative creative infrastructure, Alec has extended this vision to visual art with **Gesso Studio** – a deterministic DSL for visual intent that unifies material physics, compositional logic, and on‑chain provenance.

- **LinkedIn:** [Alec Borman](https://www.linkedin.com/in/alec-borman-9680b3160/)
- **GitHub:** [@alec-borman](https://github.com/alec-borman)
- **Gesso Studio:** [github.com/alec-borman/Gesso-Studio](https://github.com/alec-borman/Gesso-Studio)

For inquiries, collaborations, or to discuss the future of deterministic creative tools, reach out directly.
