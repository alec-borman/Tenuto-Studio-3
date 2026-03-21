<div align="center">
  <div class="w-16 h-16 rounded bg-indigo-600 flex items-center justify-center font-bold text-white text-3xl mx-auto mb-4">T</div>
  <h1>Tenuto Studio 3.0</h1>
  <p><b>The Universal Logic Layer for Musical Physics, Typography, and DSP.</b></p>
</div>

---

## 🎵 Bridging the Semantic Gap

Historically, digital music systems forced a strict dichotomy: either the **Helmholtz model** of static, discrete pitches (represented by XML sheet music software like Sibelius/Dorico), or the **Schaefferian model** of continuous sound objects (represented by DAWs like Ableton/Logic).

**Tenuto 3.0 unifies these paradigms.** It is a deterministic, declarative domain-specific language (DSL) capable of generating mathematically perfect Sheet Music (MusicXML/SVG), absolute performance data (MIDI), and native audio rendering (Web Audio API/OSC)—all from a single, highly compressed text format.

---

## ✨ Core Features & Architecture

Tenuto Studio is built on five heavily specified architectural pillars:

### 1. T-MRL (Tenuto Music Representation Language)

- **The Stateful Cursor:** Replaces verbose XML tags with a "Sticky State" cursor. Omitted octaves and durations are mathematically inferred from the previous event, reducing token counts by up to 90% (ideal for LLM generation contexts).
- **Rational Temporal Engine:** Evaluates all rhythms using pure rational fractions (Numerator/Denominator) to eliminate IEEE 754 floating-point drift during complex tuplet and Euclidean rhythm calculations.
- **Micro-Timing:** `.push(ms)` and `.pull(ms)` primitives allow for unquantized, humanized "pocket" grooves in the audio output without corrupting the visually quantized sheet music.

### 2. TSA (Tenuto Studio Architecture)

- **Agentic Compilation Loop:** Offloads parsing, AST resolution, and continuous playback synchronization to high-speed Web Workers.
- **The `tenuto-lint` Sandbox:** Music theory is decoupled from the parser. Modular heuristic plugins actively scan the AST for physical impossibilities (e.g., chords spanning >10ths) or acoustic muddying (dense intervals below C3), piping structured JSON diagnostics directly to the Monaco Editor via LSP markers.
- **Basic Language Server Support:** Hover providers give instant feedback on notes, chords, and keywords.

### 3. TEAS (Tenuto Engraving Architecture Specification)

- **Deterministic Layout:** Uses a spring‑and‑rod model (Gourlay spacing) to position events horizontally, with 1D skyline arrays for vertical collision detection.
- **SMuFL & SVG Integration:** Renders noteheads, stems, accidentals, articulations, and tuplet brackets using SMuFL metadata (Bravura font). Slurs are drawn as quadratic curves.
- **Collision Detection:** `Skyline` arrays prevent overlaps between articulations, lyrics, and noteheads, ensuring clean typography.

### 4. Zero-Friction Web Runtime (Addendum B)

- **Web Audio Backend:** Plays back standard instruments via Soundfont, synthesizers with ADSR envelopes and glide, and concrete samples with slicing – all synchronized to a high‑precision timer.
- **Live Editing:** Changes to the Tenuto source are compiled in real‑time, updating the score and audio without reloading the page.
- *Future:* Dedicated `AudioWorklet` for zero‑jitter continuous automation, internal `bus://` routing for live sample resampling.

### 5. The Wasm Bridge (Rust Backend)

- **Zero-Copy Decompilation:** The engine uses a high-performance Rust WebAssembly backend (`tenutoc`) to ingest raw MIDI binaries directly from the browser's memory, applying LZ77 dictionary coding and reverse‑Bresenham math to algorithmically decompile MIDI into clean, idiomatic T-MRL text.

---

## 🚀 Quick Start (Local Development)

**Prerequisites:** Node.js 18+ and optionally Rust (`cargo`) for the decompiler.

1.  **Clone and Install:**
    ```bash
    git clone https://github.com/yourusername/tenuto-studio-3.git
    cd tenuto-studio-3
    npm install
    ```

2.  **Compile the Rust Wasm Backend (Optional – for MIDI decompilation):**
    The Web Worker can use the Rust core for heavy semantic decompilation. If you skip this, the worker falls back to a mock implementation.
    ```bash
    cd tenutoc
    cargo install wasm-pack
    wasm-pack build --target web --out-dir ../public/pkg
    cd ..
    ```

3.  **Environment Setup:**
    Create a `.env.local` file in the root directory and add your Gemini API Key (if utilizing the AI generative features):
    ```env
    GEMINI_API_KEY="your_api_key_here"
    ```

4.  **Run the Studio:**
    ```bash
    npm run dev
    ```
    Open `http://localhost:3000` to access the IDE, WebGL Playback Engine, and live SVG Engraver.

---

## 🎹 Syntax Example: The Producer Suite

Tenuto maps acoustic instruments, discrete grid samplers, and continuous synthesizers in a single, human-readable block.

```tenuto
tenuto "3.0" {
  meta @{ title: "The Producer Suite", tempo: 130, time: "4/4" }
  
  def vln1 "Violin I" style=standard patch="gm_piano"
  def sub "Sub Bass" style=synth env=@{ a: 5ms, d: 1s, s: 100%, r: 50ms }
  def vox "Vocal Chops" style=concrete src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
  
  measure 1 {
    vln1: c5:4.slur "Ah" d:8 e:4.tie e:8 |
    sub: c2:2.glide(500ms) g2:2 |
    vox: c4:4.slice(1) c4:4.slice(2) c4:4.slice(3) c4:4.slice(4) |
  }
}
```

---

## 🗺️ Roadmap

- [x] **Sprint 1:** T-MRL Core Parsing & Stateful Cursors
- [x] **Sprint 2:** TSA Agentic Linter & Monaco LSP Integration
- [x] **Sprint 3:** TEAS Engraving Engine (SMuFL, Skylines, Spring-Mass)
- [x] **Sprint 4:** Addendum B (Native Web Audio DSP & Slicing)
- [x] **Sprint 5:** Rust Decompiler & Zero-Copy WASM Bridge
- [ ] **Sprint 6:** Vocal Typography (Lyrics, Hyphens, Melismas)
- [ ] **Sprint 7:** Advanced Layout (Knuth‑Plass Global Line‑breaking, Beams, Slurs as Kurbo Curves)
- [ ] **Sprint 8:** Isolated FX Chains (Per-track Delays, Reverbs) & Internal `bus://` Routing
- [ ] **Sprint 9:** TEDP (Tenuto Execution & Delegation Protocol) — Bridging the web frontend to the Rust `tenutod` daemon for OSC SuperCollider routing and peer‑to‑peer Ableton Link synchronization.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
