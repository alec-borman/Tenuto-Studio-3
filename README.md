# Tenuto Studio 3

Tenuto Studio 3 is the official web-based integrated development environment (IDE) for the Tenuto music notation language. It provides a seamless, high-performance interface for composing, visualizing, and synthesizing music using the Tenuto DSL. By leveraging a Rust-based compilation engine running in Web Workers and WebGL-accelerated score rendering, Tenuto Studio 3 offers a zero-latency, archival-safe, and AI-optimized environment for modern music production.

Tenuto Studio 3 combines a custom domain-specific language (Tenuto) with a high-performance Rust-based compilation engine, real-time audio synthesis, and WebGL-accelerated visualization.

## Features

- **Tenuto DSL**: A powerful, expressive language for defining complex musical structures.
- **Rust-Powered Engine**: Fast compilation and engraving using Rust (`tenutoc`).
- **Real-time Audio**: Integrated playback using Tone.js.
- **Visual Rendering**: WebGL-based rendering for smooth, responsive score visualization.
- **IDE Experience**: Syntax-highlighted editing powered by Monaco Editor.

## Architecture

- **Frontend**: React, Monaco Editor, Tone.js.
- **Compiler/Backend**: Rust (`tenutoc` crate for compilation/engraving, `tenutod` for OSC/scheduling).
- **Build System**: Vite.

## Getting Started

### Prerequisites

- Node.js (v18+)
- Rust & Cargo (latest stable)

### Installation

1. Clone the repository.
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Build the Rust components:
   ```bash
   cd tenutoc && cargo build --release
   cd ../tenutod && cargo build --release
   ```

### Running the Development Server

```bash
npm run dev
```

## Project Structure

- `/src`: Frontend React application and compiler/engraver logic.
- `/tenutoc`: Rust crate for Tenuto compilation and engraving.
- `/tenutod`: Rust daemon for scheduling and OSC communication.
- `/public`: Static assets and Web Workers.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

[Add License Information Here]

## Addendum: Monetization & Sustainability

Tenuto Studio 3 is committed to open-source accessibility as a mechanism for standardization. We believe that by making Tenuto the universal language for music and audio, we create a robust ecosystem that benefits all users. Our monetization strategy is built on capturing value through high-value extensions and managed services, rather than restricting access to the core technology.

### 1. Open Core Strategy
The core `tenutoc` engine and basic Tenuto Studio interface will remain open-source. We monetize through:
- **Proprietary Sound Libraries**: High-fidelity, professionally sampled instrument libraries that plug into the `style=synth` engine.
- **Advanced AI Agents**: Premium, fine-tuned models for complex multi-track orchestration.
- **Professional Engraving Plugins**: Advanced, publication-ready features for professional music publishing.

### 2. Managed Infrastructure (Tenuto Cloud)
We provide the convenience of the cloud for power users and enterprises:
- **Tenuto Cloud**: A SaaS platform for real-time collaboration, project history, version control, and compute-intensive score rendering.
- **API-as-a-Service**: Managed API endpoints for enterprises to integrate Tenuto into proprietary software, offloading infrastructure maintenance.

### 3. Enterprise & Support
- **Commercial Licensing**: For organizations requiring indemnification or proprietary use cases.
- **Custom Development**: Professional services to build custom "Cognitive Engines" for specific studio requirements.
- **Priority Support**: SLAs, dedicated support, and training for professional studios and educational institutions.

## Roadmap to 100% Compliance

### Current Implementation Status
| Component | Estimated Implementation | Status Analysis |
| :--- | :--- | :--- |
| **Core Compiler (tenutoc)** | **65%** | Hand-rolled TS lexer/parser handles ~90% of syntax; Rust-to-WASM pipeline is in skeleton phase (0% of target spec). |
| **TEAS (Engraving)** | **40%** | Basic Gourlay spacing and SVG export implemented; lacks Knuth-Plass justification and collision detection. |
| **Audio/Visual Engine** | **30%** | Tone.js provides basic playback; lacks AudioWorklet SoundFont integration and advanced WebGL shaders. |
| **Decompiler & Ecosystem** | **15%** | Basic MIDI-to-Tenuto stub exists; lacks MusicXML 4.0, macro extraction, and package management. |

### Detailed Analysis & Gap Assessment

#### 1. The Core Compiler (The Brain)
- **Current**: A TypeScript-based hand-rolled lexer and recursive descent parser. It successfully handles nested tuplets, multiple voices, and measure-based scoping.
- **Gaps**:
  - **Rational Arithmetic**: Current timing uses floating-point numbers, leading to quantization errors in complex polymeters.
  - **Formal Grammar**: The TS parser is fragile. The transition to a Rust-based `logos` lexer and `rowan` (lossless syntax tree) is required for LSP support.
  - **LSP**: No real-time semantic feedback or auto-completion in Monaco.

#### 2. TEAS (Engraving)
- **Current**: Implements a basic version of Gourlay spacing (C * d^k) for horizontal layout. Supports simple system breaking and SVG rendering.
- **Gaps**:
  - **Justification**: Uses a simple stretch factor instead of the optimal Knuth-Plass line-breaking algorithm.
  - **Collision Detection**: No logic to prevent slurs from intersecting with stems or accidentals.
  - **Orchestral Support**: Lacks dynamic staff grouping and bracket rendering for large scores.

#### 3. Audio/Visual Engine
- **Current**: Standard Tone.js scheduling. WebGL piano roll provides basic visual feedback.
- **Gaps**:
  - **Synthesis**: Limited to generic oscillators or basic samples; requires a full AudioWorklet-based SoundFont engine for professional patches.
  - **Visuals**: Piano roll is static; needs custom shaders for "hit" effects and smooth, clock-synced scrolling.

#### 4. Decompiler & Ecosystem
- **Current**: A basic Rust stub for MIDI ingestion.
- **Gaps**:
  - **Semantic Extraction**: No logic to identify motifs or compress repeated patterns into Tenuto macros ($macros).
  - **Interop**: MusicXML 4.0 support is non-existent, limiting migration from Finale/Sibelius.

### Epic 1: The Core Compiler & WASM Integration (The Brain)
The goal: A mathematically flawless, fully integrated Rust-to-WASM pipeline that parses 100% of the Tenuto 3.0 grammar.
- **Sprint 1: The WASM Bridge**
  - Replace `public/pkg/tenutoc.js` mocks with actual `wasm-bindgen` outputs.
  - Implement zero-copy memory transfers between Rust and the Web Workers for massive MIDI files.
- **Sprint 2: The Formal Grammar**
  - Implement a robust parser (e.g., using `logos` and `rowan` in Rust) for the complete Tenuto syntax, including nested tuplets `<[ ]>`, polymeters, and microtonal accidentals.
  - Build the Semantic Analyzer to catch impossible rhythms and out-of-range pitches at compile time.
- **Sprint 3: The Language Server Protocol (LSP)**
  - Expose the Rust compiler as an LSP to Monaco.
  - Implement real-time error squiggles, hover documentation for chords, and semantic highlighting.

### Epic 2: TEAS (Tenuto Engraving & Articulation System)
The goal: Output SVG/PDFs that rival traditional hand-engraved sheet music (Henle Verlag quality).
- **Sprint 4: The Layout Engine (Horizontal)**
  - Implement the Knuth-Plass line-breaking algorithm to dynamically justify measures across systems.
  - Implement optical spacing (Gourlay spacing) so 16th notes take up proportionally correct space relative to whole notes.
- **Sprint 5: The Layout Engine (Vertical & Collision)**
  - Implement a bounding-box collision detection system to automatically resolve overlapping slurs, ties, and dynamics.
  - Implement dynamic staff grouping and bracket rendering for orchestral scores.
- **Sprint 6: Advanced Notation**
  - Render complex nested tuplets with proper bracket angles.
  - Support cross-staff beaming and grace notes.

### Epic 3: The Audio/Visual Engine (The Performance)
The goal: Sample-accurate audio synthesis and 120fps visual feedback.
- **Sprint 7: The Synthesizer**
  - Integrate a WebAudio/AudioWorklet SoundFont (SF2/SFZ) player.
  - Map Tenuto `patch=""` definitions to actual instrument samples.
  - Implement sample-accurate scheduling using `audioContext.currentTime`.
- **Sprint 8: Advanced WebGL**
  - Upgrade the WebGL piano roll with custom shaders (bloom effects for active notes, particle systems for hits).
  - Implement smooth, continuous scrolling tied to the AudioContext clock.

### Epic 4: The Decompiler & Ecosystem (Addendum D)
The goal: The ultimate translation layer. Ingest anything, output perfect Tenuto.
- **Sprint 9: Advanced Decompilation**
  - Enhance the LZ77 macro extractor to recognize transposed motifs (e.g., extracting a sequence and calling it as `$macro_1 + 4st`).
  - Implement swing-detection heuristics to snap off-grid MIDI into `swing=66%` metadata rather than complex tuplets.
- **Sprint 10: Interoperability**
  - Implement full MusicXML 4.0 export and import.
  - Implement a package manager for Tenuto (e.g., `import "std/orchestra"`).

*Tenuto: Write music as code. Compile to everything.*
