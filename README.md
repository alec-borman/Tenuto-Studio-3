# Tenuto Studio 3.0

#### 🎵 The Vision: System of Record for Music
What if you could capture every nuance of a musical composition—the pitches, rhythms, articulations, lyrics, micro‑timing, synthesizer envelopes, sample slices, and even the routing of effects—in a single, human‑readable text file? What if that same file could be instantly rendered as a beautifully engraved score, a perfectly quantized MIDI performance, a full‑fidelity audio mix, and a live‑coding session synchronized with Ableton Link?

**Tenuto is that file.** It is a deterministic, declarative domain‑specific language designed to be the standard output format for AI music models, providing a transparent, editable, and versionable alternative to "Black Box" audio generation. It unifies the discrete logic of classical notation with the continuous physics of modern DSP into a single, human-readable "Narrow Waist" protocol. Like a Customer Relationship Management (CRM) system consolidates all client interactions, Tenuto consolidates every aspect of a musical work—from the ink on the page to the electricity in the speakers—into a single, version‑controllable, AI‑friendly format.

#### 🚀 The Producer Update (v3.0)
Version 3.0 shatters the boundary between acoustic notation and electronic production.
*   **Continuous Physics (`style=synth`):** Define global ADSR envelopes, LFOs, and execute continuous portamento glides (`.glide(150ms)`) directly from the text.
*   **Concrete Sampling (`style=concrete`):** Map raw audio buffers to alphanumeric keys. Execute granular slicing (`.slice(8)`), time-stretching, and phase-vocoding natively.
*   **Rational Timelines & Micro-Timing:** Tenuto evaluates all time using Rational Arithmetic (P/Q) to eliminate floating-point drift. Inject human "pocket" via absolute micro-timing modifiers (`.pull(15ms)`).
*   **The Bi-Directional Projectional DAW:** Tenuto 3.0 introduces a revolutionary DAW interface. The GUI possesses no hidden state; dragging a block visually executes a deterministic text-mutation algorithm on the underlying `.ten` source code.

#### 🌐 The Zero-Friction WebAssembly Runtime
Tenuto 3.0 is designed for the web. The core Rust compiler (`tenutoc`) compiles to `wasm32-unknown-unknown`, allowing you to embed procedural music directly into any web page with zero external dependencies.

#### 🧠 AI Orchestration & LanceDB RAG
As your symphony scales to 50,000+ lines of code, Tenuto scales with you. The ecosystem includes an AST-Aware Semantic Indexer powered by **LanceDB**. This allows AI collaborators to execute surgical, Retrieval-Augmented Generation (RAG) queries against your codebase, understanding the "Musical Intent" without hallucinating syntax.

---

#### 🛠️ Getting Started: Building & Running Tenuto Studio 3.0
Tenuto Studio runs locally as a Vite + React application, powered by a Rust WebAssembly compiler. 
**Critical:** You must compile the Rust Core into WebAssembly (`npm run build:wasm`) before starting the frontend development server.

##### 1. Prerequisites (All Platforms)
Ensure you have the following installed before proceeding:
1. **Node.js** (v18 or higher)
2. **Rust & Cargo** (Latest stable)
3. **wasm-pack** (Required for compiling Rust to WebAssembly)

##### 2. Platform-Specific Setup & Build Instructions

**🍎 macOS**
```bash
# 1. Install Node.js (if not installed, via Homebrew)
brew install node

# 2. Install Rust & Cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# 3. Add the WebAssembly target and install wasm-pack
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# 4. Clone, Build, and Run
git clone https://github.com/your-repo/tenuto-studio-3.0.git
cd tenuto-studio-3.0
npm install
npm run build:wasm
npm run dev
```

**🐧 Linux (Ubuntu/Debian)**
```bash
# 1. Install Build Essentials (Required for Rust compilation) and curl
sudo apt-get update && sudo apt-get install -y build-essential curl

# 2. Install Node.js (via NodeSource or your preferred package manager)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install Rust & Cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# 4. Add the WebAssembly target and install wasm-pack
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# 5. Clone, Build, and Run
git clone https://github.com/your-repo/tenuto-studio-3.0.git
cd tenuto-studio-3.0
npm install
npm run build:wasm
npm run dev
```

**🪟 Windows**
```powershell
# 1. Install Visual Studio C++ Build tools 
# (Required for Rust. Download from Microsoft's website and install the "Desktop development with C++" workload)

# 2. Install Node.js
# Download the Windows Installer (.msi) from nodejs.org and run it.

# 3. Install Rust
# Download and run rustup-init.exe from https://rustup.rs/

# 4. Open a new terminal (PowerShell or Git Bash) as Administrator and install Wasm tools
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# 5. Clone, Build, and Run
git clone https://github.com/your-repo/tenuto-studio-3.0.git
cd tenuto-studio-3.0
npm install
npm run build:wasm
npm run dev
```

**Once the development server is running, open `http://localhost:3000` in your browser.**

---

#### 🎹 Usage Instructions
1. **Write Intent:** Use the left-hand Monaco editor to write declarative Tenuto code (e.g., `tenuto "3.0" { ... }`).
2. **Compile:** The code is automatically sent across the FFI boundary to the Rust Wasm compiler (`tenutoc`).
3. **Play:** Click the "Play" button to render the JSON Intermediate Representation (IR) through the browser's WebAudio API (Tone.js/smplr).
4. **Export:** Download the generated MIDI 1.0 file, MusicXML layout, or view the raw AST/IR payloads.

#### 📊 Current Status
The Tenuto compiler core is stable and all tests pass. Implemented core features include:
*   **Rational Timeline:** Deterministic absolute time accumulation (`src/timeline.rs`).
*   **Stateful Cursor:** Tracks octave, duration, and velocity per voice (`src/cursor.rs`).
*   **Euclidean Rhythms:** Algorithmic beat generation (`src/euclidean.rs`).
*   **Spelling Engine & Lexer:** Fully tested and compliant.
*   **Concrete & Synth Engines:** Full JSON AST serialization mapping with default HashMap fallback resolving `E0000` Wasm errors.

For remaining work, see our `ROADMAP.md` and the Tenuto 3.0 Specification.

#### 🤝 Contributing & CI Delta Tracking
Tenuto uses the **Teleportation Protocol** for development. All contributions must be accompanied by a `.tela` sprint file. Our GitHub Actions CI automatically computes the **Vector Delta** between your code and the target blueprint. Pull requests must achieve a delta of `<= 0.02` to be merged. See `CONTRIBUTING.md` for details.

#### 🛡️ Sustainability & Backing
Tenuto 3.0 is a sovereign, open-source project built to fundamentally solve the AI music representation gap. If this architecture helps your team, or if you want to accelerate the development of the upcoming **Full SVG Engraving** engine, consider supporting the core development directly:

☕ **[Support the Architect via PayPal](https://paypal.me/alecborman)**

#### 🌍 Portability & Cross-Device Execution
Tenuto Studio is designed under the **Local-First Covenant**. Because the core compiler (`tenutoc`) is written in memory-safe Rust and targets `wasm32-unknown-unknown`, it is inherently portable to almost any device:
*   **Mobile & Tablets (iOS/Android):** The `<tenuto-score>` Web Component runs natively in mobile browsers (Safari/Chrome) without modification.
*   **Native Apps:** The Wasm binary can be embedded directly into iOS (via JavaScriptCore) or Android (via V8) apps, bypassing the DOM entirely.
*   **Edge Runtimes:** `tenutoc` can run on Cloudflare Workers or Deno Deploy for serverless compilation.
*   **Embedded Hardware:** Using runtimes like Wasmtime or WasmEdge, the Tenuto compiler can be ported to Raspberry Pi, digital synthesizers, or Eurorack modules, allowing hardware to natively understand Tenuto code.