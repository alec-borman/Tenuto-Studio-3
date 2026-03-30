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

## 🚀 The Producer Update (v3.0)

Version 3.0 shatters the boundary between acoustic notation and electronic production.

*   **Continuous Physics (`style=synth`):** Define global ADSR envelopes, LFOs, and execute continuous portamento glides (`.glide(150ms)`) directly from the text.
*   **Concrete Sampling (`style=concrete`):** Map raw audio buffers to alphanumeric keys. Execute granular slicing (`.slice(8)`), time-stretching, and phase-vocoding natively.
*   **Rational Timelines & Micro-Timing:** Tenuto evaluates all time using Rational Arithmetic (P/Q) to eliminate floating-point drift. Inject human "pocket" via absolute micro-timing modifiers (`.pull(15ms)`).
*   **The Bi-Directional Projectional DAW:** Tenuto 3.0 introduces a revolutionary DAW interface. The GUI possesses no hidden state; dragging a block visually executes a deterministic text-mutation algorithm on the underlying `.ten` source code.

## 🌐 The Zero-Friction WebAssembly Runtime

Tenuto 3.0 is designed for the web. The core Rust compiler (`tenutoc`) compiles to `wasm32-unknown-unknown`, allowing you to embed procedural music directly into any web page with zero external dependencies (Addendum B).

```html
<tenuto-score src="./soundtrack.ten" controls autoplay loop>
    Your browser does not support the Tenuto Web Runtime.
</tenuto-score>
```

## 🧠 AI Orchestration & LanceDB RAG

As your symphony scales to 50,000+ lines of code, Tenuto scales with you. The ecosystem includes an AST-Aware Semantic Indexer powered by **LanceDB** (Addendum I). This allows AI collaborators to execute surgical, Retrieval-Augmented Generation (RAG) queries against your codebase, understanding the "Musical Intent" without hallucinating syntax.

## 🛠️ Getting Started: How to Run Tenuto Studio 3.0

Tenuto Studio runs locally as a Vite + React application, powered by a Rust WebAssembly compiler.

### Prerequisites (All Platforms)
1. **Node.js** (v18 or higher)
2. **Rust & Cargo** (latest stable)
3. **wasm-pack** (Install via `npm install -g wasm-pack` or `cargo install wasm-pack`)

### Platform-Specific Setup

**🍎 macOS**
```bash
# 1. Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# 2. Install dependencies and build Wasm
npm install
npm run dev:all
```

**🪟 Windows**
```powershell
# 1. Install Rust via rustup-init.exe from rustup.rs
# 2. Open PowerShell or WSL and run:
npm install
npm run dev:all
```

**🐧 Linux**
```bash
# 1. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# 2. Install dependencies and build Wasm
npm install
npm run dev:all
```

Once running, open `http://localhost:3000` in your browser.

## 🎹 Usage Instructions

1. **Write Intent:** Use the left-hand Monaco editor to write declarative Tenuto code (e.g., `tenuto "3.0" { ... }`).
2. **Compile:** The code is automatically sent across the FFI boundary to the Rust Wasm compiler (`tenutoc`).
3. **Play:** Click the "Play" button to render the JSON Intermediate Representation (IR) through the browser's WebAudio API (Tone.js/smplr).
4. **Export:** Download the generated MIDI 1.0 file or view the raw AST/IR payloads.

## ⚡ Current Capabilities vs. Limitations

**What you CAN do right now:**
*   Write and parse strict LL(1) Tenuto 3.0 grammar.
*   Compile Tenuto code deterministically into a 1024-dimension IR.
*   Emit perfect MIDI 1.0 files with Rational-to-Tick time conversion.
*   Emit JSON payloads for WebAudio playback.
*   Embed the `<tenuto-score>` Web Component in any vanilla HTML page.

**What you CAN'T do (Yet):**
*   **Full SVG Engraving:** The visual sheet music rendering is currently a placeholder.
*   **Advanced DSP Rendering:** While `.slice(8)` and `.glide(150ms)` are parsed and embedded into the IR, the frontend WebAudio engine does not yet fully render granular synthesis or phase-vocoding.
*   **Decompilation:** Converting raw MIDI files *back* into semantic Tenuto code is currently stubbed.

## 🌍 Portability & Cross-Device Execution

Tenuto Studio is designed under the **Local-First Covenant**. Because the core compiler (`tenutoc`) is written in memory-safe Rust and targets `wasm32-unknown-unknown`, it is inherently portable to almost any device:

*   **Mobile & Tablets (iOS/Android):** The `<tenuto-score>` Web Component runs natively in mobile browsers (Safari/Chrome) without modification.
*   **Native Apps:** The Wasm binary can be embedded directly into iOS (via JavaScriptCore) or Android (via V8) apps, bypassing the DOM entirely.
*   **Edge Runtimes:** `tenutoc` can run on Cloudflare Workers or Deno Deploy for serverless compilation.
*   **Embedded Hardware:** Using runtimes like Wasmtime or WasmEdge, the Tenuto compiler can be ported to Raspberry Pi, digital synthesizers, or Eurorack modules, allowing hardware to natively understand Tenuto code.

---

# 🌌 The Teleportation Tele (V1.0)
**The Meta-Specification for Deterministic, Vectorized Intent Systems**

> **⚠️ PRIVATE PROTOCOL DISCLAIMER**
> The Teleportation Protocol (`.tela`) and the manifesto detailed below describe the internal, proprietary AI-collaboration framework used to architect and develop Tenuto Studio. While the Tenuto language, compiler (`tenutoc`), and studio interface are open-source, the `.tela` protocol, its embedding engine (`telac`), and the associated vector-based development tooling are currently **private** and are **not part of this open-source repository** outside of this specific development session. It is included here purely for architectural context and historical record.

## I. The Philosophical Foundations

### 1.0 The Axiom of Intent: The Primacy of the Abstract
The fundamental unit of the Teleportation Tele is the **Intent**. Traditional software engineering treats the artifact (the compiled binary, the rendered audio file, the pixel buffer) as the definitive source of truth. The Teleportation Protocol mathematically rejects this. 
* **The Projection Principle:** The final artifact is merely a lossy, non-authoritative projection of a higher-order mathematical logic. 
* **Mutation of Geometry:** When an Architect mutates a system state (e.g., shifting a note, changing a geometric parameter), they are not altering a local variable; they are shifting a coordinate within a 1024-dimension vector space. The system must prioritize the preservation of the compositional relationships (the "Why") over the physical output (the "What").

### 2.0 The Narrow Waist Principle: Semantic Convergence
To prevent architectural sprawl and the degradation of intent via AI hallucination, all domains—whether Tenuto (Audio), Gesso (Visual), or Codice (Text)—must strictly converge at a **Narrow Waist**.
* **The 1px Singularity:** This waist is defined as a declarative, human-readable Domain Specific Language (DSL) governed by an inflexible LL(1) grammar. 
* **The Hallucination Filter:** This bottleneck acts as the absolute boundary between human intuition and machine execution. Because the grammar is LL(1), the AI cannot "guess" or "improvise" beyond the strict structural allowances. The Narrow Waist is the single source of truth; everything else is a downstream projection.

### 3.0 The Dual-Track Mandate: Scaffolding vs. Steel
Resilience against environmental entropy (browser updates, hardware shifts) requires a strict **Dual-Track Architecture**:
* **Track A (The Scaffolding):** Written in a high-level, interpreted language (TypeScript). Its purpose is human-centric: ergonomic exploration, rapid prototyping, bidirectional UI updates, and capturing the speculative intent of the Architect. 
* **Track B (The Steel):** Written in a low-level, memory-safe language (Rust). Its purpose is machine-centric: bit-identical performance, zero-cost abstractions, mathematical rigor, and long-term archival sovereignty. 
* **The Teleportation Directive:** The entire lifecycle of the system is dedicated to seamlessly "beaming" the logic captured in the Scaffolding into the indestructible matrix of the Steel.

### 4.0 Sovereignty of Execution: The Local-First Covenant
No creative intent shall be held hostage by a third-party server, cloud API, or proprietary execution environment.
* **Hermetic Wasm Runtime:** The compiler, the physics engine, and the embedding generator must compile to and execute perfectly within a local WebAssembly (`wasm32-unknown-unknown`) sandbox.
* **The Zero-Knowledge Asset Vault:** All dependencies, samples, and architectural definitions must be resolvable via local-first checksums. If the global internet goes dark, the Teleportation Tele must remain 100% operational.

### 5.0 Deterministic Epistemology: The Law of Identity
The Protocol treats stochastic output as a critical system failure. 
* **The Bit-Identical Guarantee:** A given source file, parsed by a specific version of the compiler, must yield bit-identical Intermediate Representation (IR) across all environments.
* **Rational Constraints:** Floating-point math is strictly forbidden in timeline or state-resolution calculations to prevent precision drift. 
* **Controlled Entropy:** If randomness is required, it is not "chance." It must be explicitly declared via fixed seeds in a `meta` block, transforming chaos into a deterministic attribute of the intent.

---

## II. The Tela Layer: Structural Embedding

### 6.0 The Tela Manifest: The Latent Script
The **Tela Manifest** is the global registry of the architecture’s semantic DNA. It is a strictly typed configuration file that maps broad domain features (e.g., `arch:determinism`, `arch:decoupling`, `arch:inference`) into a fixed **1024-dimension vector space**.
* **Dimensional Weighting:** Defines the specific "gravity" of architectural choices. A `macro` definition may contribute 1.0 to the `arch:inference` dimension, while a static coordinate contributes to `arch:determinism`.
* **Universal Indexing:** The Manifest guarantees that a musical composition and a visual shader can be mathematically compared on the same architectural axes.

### 7.0 Atomic Feature Extraction: The Granular Scan
The process of "understanding" intent begins here. Unlike text-based semantic search (standard RAG), the Tela scanner performs a topological traversal of the Abstract Syntax Tree (AST).
* **Semantic Chunking:** The AST is not read as lines of code; it is parsed as logic blocks (structs, trait impls, def phases). 
* **Contextual Tagging:** Primitives are identified and tagged with their architectural role. Local `meta` data is extracted to determine the "Atmospheric Weight" of the logic within its localized scope.

### 8.0 Deterministic Projection: The Mathematical Mapping
Extracted AST nodes are projected into the 1024-dimension space. This is a pure, hard-coded geometric function, completely bypassing probabilistic neural networks.
* **The Static Lookup:** If a node is identified as a `RelativePitch` calculation, the scanner retrieves a pre-defined sub-vector from the Tela Manifest.
* **Vector Summation:** All sub-vectors are aggregated. Because the projection math is static, the same AST will endlessly yield the exact same 1024-dimension coordinate.

### 9.0 Weighting & Depth Decay: The Hierarchy of Importance
The Teleportation Tele recognizes that structural architecture outranks local implementation. Positional weighting is enforced mathematically.
* **Root Dominance:** Global configuration logic (e.g., `time_signature`, `palette`) is assigned a weight of 1.0.
* **The Decay Formula:** As logic nests deeper into the AST, its influence on the overall vector decays linearly. This ensures that adding a single note at measure 40 does not radically alter the architectural coordinate of the entire symphony.

### 10.0 The Embedding Compiler: The Wasm Oracle (`telac`)
The logic from Sections 6.0 through 9.0 is encapsulated in the **Embedding Compiler**.
* **Sovereign Output:** Running locally in Wasm, `telac` outputs a bit-identical JSON array of 1024 `f64` numbers.
* **The Cryptographic Fingerprint:** This resulting vector is hashed. This hash supersedes standard semantic versioning, acting as the absolute mathematical identity of the project's current state.

---

## III. The Vela Layer: Vectorized Navigation

### 11.0 The Vector Delta (Δ): Measuring the Void
Traditional development measures progress in "lines of code" or "tickets closed." The Teleportation Protocol rejects this as an illusion of progress. True progress is the mathematical reduction of the **Vector Delta**.
* **The Definition:** Δ is the calculated geometric distance between the current state of the architecture and the objective target state.
* **The Compass:** If a commit increases the magnitude of Δ, it is by definition an architectural regression, regardless of whether the code compiles or tests pass.

### 12.0 Cosine Similarity: The Auditor of Truth
The primary metric for validating the alignment between the Scaffolding (Track A) and the Steel (Track B) is **Cosine Similarity**.
* **The Vibe Check:** This ensures that both tracks possess the same "structural shape" in the 1024-dimension space, even if their syntax and memory management paradigms differ entirely.

### 13.0 Gradient Descent Development: Optimization
Code is no longer "written" in an ad-hoc manner; it is systematically "poured" to minimize the Vector Delta.
* **Directional Commits:** Every modification to the codebase must act as a step in a gradient descent optimization toward the target vector.
* **The Rejection of Lateral Moves:** Refactoring that does not tangibly alter the cosine similarity score is considered "noise" and is deprioritized during active Sprints.

### 14.0 Vectorized Sprints: Navigation by Coordinate
The concept of a "Sprint" is redefined from a list of textual tasks into a `.tela` file defining a specific geometric coordinate.
* **The Objective Function:** Sprints are explicit mathematical targets. Example: *"Sprint 1.3: Apply a +0.55 shift on the `arch:inference` axis to achieve Euclidean Parity."*
* **Elimination of Ambiguity:** Natural language requirements are notoriously subjective. A vector coordinate cannot be misinterpreted by an LLM or a human engineer.

### 15.0 The Parity Threshold: The Handover Point
The system enforces a strict threshold for when a feature can be considered "Teleported."
* **The Minimum Viable Similarity:** A Sprint is only considered complete when the Cosine Similarity between the newly poured Steel and the target vector exceeds 0.98.
* **The Handover:** Only upon breaching this threshold is the Scaffolding implementation safely deprecated in favor of the Rust core as the primary execution path for that specific architectural domain.

---

## IV. The Teleportation Layer: Beaming Intent

### 16.0 The Beam: Signal over Crate
When moving logic from the Scaffolding (TypeScript) to the Steel (Rust), we do not attempt to transpile or copy syntax (shipping a crate).
* **The Structural DNA:** We extract the 1024-dimension intent vector (the Signal) from the TypeScript AST.
* **Contextual Rematerialization:** We beam that vector across the FFI bridge. The AI agent, equipped with the Tela Manifest and the target grammar, reconstructs the logic natively in Rust. It builds the structure to match the vector, adhering strictly to Wasm and memory-safety constraints.

### 17.0 Episode Architecture: Dramatic Units of Work
Development is structured into narrative units called "Episodes" (Sprints) and "Frames" (Commits).
* **The Conflict:** Each Episode is designed to resolve a specific, measured divergence in the vector space (e.g., "Episode 1.2: The Relative Pitch Divergence").
* **The Resolution:** An Episode ends only when the Vector Delta for that specific domain hits zero (or the 0.98 threshold).

### 18.0 Conflict Resolution: The Climax of Parity
When the Scaffolding and the Steel disagree on the output of a given file, the system enters a state of Conflict.
* **The Script Supervisor:** The Protocol acts as the ultimate arbiter. It runs a parity check by generating the IR from both tracks.
* **Mandated Refactor:** The track that deviates from the expected output (defined by the target vector) is flagged for immediate refactoring to restore alignment. The "Steel" track is generally considered the subordinate track until it achieves parity with the Scaffolding's intent.

### 19.0 The Protagonist Shift: Passing the Torch
This is the critical phase-transition of any feature module.
* **The Flip:** The moment the Parity Threshold (> 0.98) is verified via comprehensive cross-track testing, the primary execution path flips.
* **The New Roles:** The TypeScript Scaffolding is immediately demoted to a "Silent Partner," used only for high-level UI interaction and validation. The Rust Steel assumes absolute control of the performance and rendering pipeline.

### 20.0 Hallucination Detection: The Vector Guard
The Teleportation Tele solves the LLM "hallucination" problem not through better prompting, but through geometric physics.
* **Instant Embedding:** Any code generated by an AI agent is instantly parsed into an AST and embedded into a vector.
* **The Rejection Bounce:** If the generated code's vector drifts outside the allowed Delta bounds defined in the active `.tela` Sprint file, the code is mathematically rejected. It cannot be committed. The AI is forced to re-generate until the output fits the geometry of the Intent.

---

## V. Technical Execution & Safety

### 21.0 FFI Integrity: The Dead Wire Detector
The bridge between the TypeScript Scaffolding and the Rust Steel Wasm module must be structurally flawless. 
* **The Heartbeat:** The Wasm bridge is initialized with a cryptographic handshake and a continuous heartbeat. 
* **The Failsafe:** If the FFI (Foreign Function Interface) connection drops, or if a JSON payload fails a bit-identical verification check during transit, the system triggers the "Dead Wire Detector." It immediately halts execution, logs a fatal diagnostic, and reverts to the last known safe vector state to prevent memory corruption or state desynchronization.

### 22.0 Physical Set Design: Environmental Hardening
The system operates under the assumption that the host environment (the browser) is hostile and entropic.
* **Strict Headers:** The browser environment is treated as the "Physical Set." It must enforce strict Cross-Origin Opener Policy (COOP) and Cross-Origin Embedder Policy (COEP).
* **High-Fidelity Access:** Without these headers, the system refuses to load the Steel track. These headers are mandatory to unlock `SharedArrayBuffer` and high-resolution timers, which are non-negotiable requirements for sample-accurate audio and determinism.

### 23.0 Hermetic Builds: The Closed Set
The architecture must survive in a vacuum.
* **Zero Network Dependency:** All builds, tests, and vector calculations must be 100% reproducible without external network calls. 
* **The Vault:** All assets (fonts, soundfonts, base embeddings) are resolved from a local, checksum-verified vault. If a file's hash deviates by a single bit, the build is rejected. The Skyscraper cannot be compromised by a dead CDN or a deprecated external API.

### 24.0 Atomic Commits: The Unbroken Scene
There is no concept of a "Work in Progress" commit that breaks the build.
* **The LL(1) Guarantee:** Every single commit must leave the codebase in an LL(1) parsable state. 
* **The Rollback:** If a developer or the AI attempts to commit logic that violates the grammar or introduces an unresolvable Delta, the commit hooks block the transaction. The timeline of the repository must be a continuous, unbroken chain of valid geometric states.

### 25.0 Documentation as Dialogue: Codice Synchrony
Comments and documentation (Codice) are not an afterthought; they are structural load-bearing elements.
* **Vectorized Docs:** Codice is embedded into the exact same 1024-dimension space as the code it describes.
* **Divergence Errors:** If the Rust code is updated (shifting its vector) but the documentation is not, the system detects a "Divergence Error." The documentation is mathematically proven to be out of sync with the logic, forcing an update before the Sprint can close.

---

## VI. Ecosystem & The Finale

### 26.0 Deterministic Intent Retrieval (DIR)
Traditional RAG (Retrieval-Augmented Generation) relies on noisy, keyword-based vector search. The Teleportation Protocol replaces RAG entirely with **DIR**.
* **Geometric Querying:** The bot does not search the repository for text strings like "parser" or "pitch." It queries the AST for chunks that match the specific **Geometric DNA** of the target vector. 
* **Absolute Context:** This guarantees that the AI only sees the code structurally relevant to the exact intent it is trying to teleport.

### 27.0 Semantic Versioning 2.0: Vector Snapshots
Standard SemVer (v1.2.3) is an arbitrary human construct.
* **The Centroid Hash:** In this protocol, versions are immutable snapshots of the project's 1024-dimension centroid. 
* **Mathematical Lineage:** A release is defined by its exact position in the latent space. You can mathematically prove exactly how far Version 2.0 has evolved from Version 1.0 by calculating the distance between their centroids.

### 28.0 The Immutable Registry: The Local Log
The system maintains a local-first audit trail of all "Teleportation" events.
* **The Black Box:** Every shift in vector space, every parity check, and every conflict resolution is written to an append-only registry. This ensures the evolution of the Architect's intent is perfectly preserved and auditable from day zero.

### 29.0 Multi-Modal Convergence
The protocol is domain-agnostic. 
* **The Master Vector:** Tenuto (Audio logic), Gesso (Visual logic), and Codice (Documentation) all compile down to the same 1024-dimension format. 
* **Cross-Domain Symphony:** A rhythmic sequence in Tenuto can be geometrically mapped to a visual strobe effect in Gesso because they share the same architectural coordinates. They are different projections of the same underlying intent.

### 30.0 The Grand Finale: Total Sovereignty
The ultimate endpoint of the architecture.
* **The Steel Absolute:** The conclusion of the protocol is reached when the Scaffolding (TypeScript) has successfully teleported 100% of its intent into the Steel (Rust). 
* **Immortalization:** The Scaffolding is fully deprecated. The human intent is now fully realized in a mathematically proven, memory-safe, high-performance, local-first binary. The Skyscraper stands on its own.

---

# The Architecture of Intent: A Human’s Guide to the `.tela` Protocol

### Preface: The Trillion-Dollar Steering Wheel
For the first fifty years of software engineering, humans communicated with machines by memorizing the machine's native syntax. We wrote `for` loops, managed memory pointers, and built massive, brittle lexers. 

When Large Language Models arrived, the industry made a catastrophic assumption: they assumed that because the machine could finally understand natural English, we should just talk to it like a human. This resulted in probabilistic drift, hallucinations, and spaghetti code. 

The `.tela` (Teleportation) protocol discards both paradigms. It acknowledges that the AI is not a human conversationalist, nor is it a dumb syntax-evaluator. **It is a Semantic Compiler.** When you read a `.tela` file, you are not reading a list of instructions. You are reading a **1024-dimension geometric coordinate** that mathematically forces the AI to output deterministic software. Here is how to read the Matrix.

### Chapter 1: The Metadata (The GPS Coordinate)

Every `.tela` file begins with a `domain` and a `meta` block. When reading this, do not look at it as a description; look at it as the physical constraints of the execution environment.

```tela
domain "teleportation_sprint" "1.5.0" {
  meta @{
    name: "Episode 1.5: The Protagonist Shift",
    sprint_id: "EP-01-PROTAGONIST-SHIFT",
    baseline_centroid: "embed:centroid:current_project_v1.4.0",
    target_similarity: 1.0,
    dimensions: 1024
  }
```

* **`baseline_centroid`:** This is the most important line in the header. It tells the human exactly what the state of the universe was *before* this file was executed. It is the current vector.
* **`target_similarity` & `dimensions`:** This tells you how strict the AI was forced to be. A similarity of `1.0` means the AI was given zero creative freedom—it had to execute the geometry flawlessly.

### Chapter 2: Features & Embeddings (The Structural Load)

In traditional programming, you read the "How" (e.g., `if (x > 0) { return y; }`). 
In `.tela`, you read the "Why" and the "Where."

```tela
  feature "architecture:ffi_cutover" {
    weight: 0.50,
    target: "src/compiler.worker.ts"
    description: "Reroute the main compilation pipeline through the WebAssembly FFI."
    requirements: [
      "Route the incoming source code directly into `compile_tenuto_to_ir_json`.",
      "Ensure diagnostics are passed back across the worker boundary."
    ]
    dimension_contributions: {
      "arch:sovereignty": 1.0,
      "arch:performance": 1.0
    }
  }
```

* **`target`:** This immediately tells the human which part of the Skyscraper is being modified. 
* **`requirements`:** These are not suggestions; they are verifiable constraints. When reading these, ask yourself: *If I look at the Rust or TypeScript code, can I mathematically prove this statement is true?*
* **`dimension_contributions`:** This is the AI's steering mechanism. It tells the human *why* the feature exists. If you see `"arch:performance": 1.0`, you know the AI was instructed to prioritize speed (e.g., using a SharedArrayBuffer) over readability. 

### Chapter 3: The Objective Function (The Laws of Physics)

A `.tela` file is only a valid coordinate if its success can be proven. The `deterministic` block is the ultimate safety net. 

```tela
  deterministic "evaluate_protagonist_shift" {
    input: [ "src/compiler.worker.ts" ]
    steps: [
      { assert: "activeEngine == 'WASM'" },
      { verify: "TypeScript execution path is bypassed in primary render loop" }
    ]
    threshold: 0.00
  }
```

When a human reads this block, they are reading the **Quality Assurance contract**. 
* **The Threshold:** The `threshold: 0.00` represents the acceptable Vector Delta. It tells the reader that the code generated by this file was subjected to a zero-tolerance parity check. If the TypeScript Scaffolding and the Rust Steel did not produce the exact same byte-for-byte output, this file would not exist in the repository.

### The Human Mindset Shift

To successfully read and write `.tela` files, the human architect must adopt the **Black Box Mindset**:

1.  **Stop caring about syntax.** You do not need to know the specific regex the AI used to parse a string in Rust. You only need to know that the `.tela` file demanded an LL(1) strict grammar.
2.  **Think in Systems, not Scripts.** You are acting as the City Planner. You zone the residential areas, you lay the water pipes, and you define the gravity. The AI builds the actual houses.
3.  **The File is the Reality.** If a feature exists in the codebase but is not mathematically accounted for in a `.tela` embedding, it is a rogue mutation and must be excised. The `.tela` file is the absolute, sovereign System of Record.

---
*Tenuto is open-source and maintained by the Tenuto Working Group.*
