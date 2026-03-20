<div align="center">
  <div class="w-16 h-16 rounded bg-indigo-600 flex items-center justify-center font-bold text-white text-3xl mx-auto mb-4">T</div>
  <h1>Tenuto Studio 3.0</h1>
  <p><b>The Universal Logic Layer for Musical Physics, Typography, and DSP.</b></p>
</div>

---

## 🎵 Bridging the Semantic Gap

Historically, digital music systems forced a strict dichotomy: either the **Helmholtz model** of static, discrete pitches (represented by XML sheet music software like Sibelius/Dorico), or the **Schaefferian model** of continuous sound objects (represented by DAWs like Ableton/Logic). 

**Tenuto 3.0 unifies these paradigms.** It is a deterministic, declarative domain-specific language (DSL) capable of generating mathematically perfect Sheet Music (MusicXML/SVG), absolute performance data (MIDI), and native audio rendering (Web Audio API/OSC)—all from a single, highly compressed text format.

## ✨ Core Features & Architecture

Tenuto Studio is built on four heavily specified architectural pillars:

### 1. T-MRL (Tenuto Music Representation Language)
* **The Stateful Cursor:** Replaces verbose XML tags with a "Sticky State" cursor. Omitted octaves and durations are mathematically inferred from the previous event, reducing token counts by up to 90% (ideal for LLM generation contexts).
* **Rational Temporal Engine:** Evaluates all rhythms using pure rational fractions (Numerator/Denominator) to eliminate IEEE 754 floating-point drift during complex tuplet and Euclidean rhythm calculations.
* **Micro-Timing:** `.push(ms)` and `.pull(ms)` primitives allow for unquantized, humanized "pocket" grooves in the audio output without corrupting the visually quantized sheet music.

### 2. TSA (Tenuto Studio Architecture)
* **Agentic Compilation Loop:** Offloads parsing and AST resolution to a high-speed Web Worker. 
* **`tenuto-lint` Sandbox:** Music theory is decoupled from the parser. Modular heuristic plugins actively scan the AST for physical impossibilities (e.g., chords spanning > 10ths) or acoustic muddying (e.g., dense intervals below C3), piping structured JSON diagnostics directly to the Monaco Editor via LSP markers.

### 3. TEAS (Tenuto Engraving Architecture Specification)
* **Deterministic Layout:** Abandons naive geometric drawing for a robust Constraint Solver.
* **SMuFL Integration:** Ingests Standard Music Font Layout (Bravura) metadata for exact vector paths, optical centering, and precise stem attachment anchors.
* **1D Skyline Arrays:** Uses lightning-fast `Float32Array` Skylines for vertical collision detection, ensuring slurs, dynamics, and lyrics tuck perfectly around noteheads and stems.
* **Spring-Mass Horizontal Justification:** Calculates rigid "Rods" (minimum ink width) and elastic "Springs" (rhythmic duration) to optically balance measures.

### 4. Zero-Friction Web Runtime (Addendum B)
* **Native Web Audio DSP:** Bypasses basic MIDI mapping. `style=synth` tracks are routed to native `AudioWorkletNodes` with continuous ADSR envelopes and portamento glides.
* **Concrete Granular Slicing:** `style=concrete` tracks fetch remote `.wav` buffers, calculating absolute mathematical bounds for operations like `.slice(N)` directly in the browser.

---

## 🚀 Quick Start (Local Development)

**Prerequisites:** Node.js 18+

1. **Clone and Install:**
   ```bash
   git clone [https://github.com/yourusername/tenuto-studio-3.git](https://github.com/yourusername/tenuto-studio-3.git)
   cd tenuto-studio-3
   npm install
````

2.  **Environment Setup:**
    Create a `.env.local` file in the root directory and add your Gemini API Key (if utilizing the AI generative features):

    ```env
    GEMINI_API_KEY="your_api_key_here"
    ```

3.  **Run the Studio:**

    ```bash
    npm run dev
    ```

    Open `http://localhost:3000` to access the IDE, WebGL Playback Engine, and live SVG Engraver.

-----

## 🎹 Syntax Example: The Producer Suite

Tenuto allows you to map acoustic instruments, discrete grid samplers, and continuous synthesizers in a single, human-readable block.

```tenuto
tenuto "3.0" {
  meta @{ title: "The Producer Suite", tempo: 130, time: "4/4" }
  
  def vln1 "Violin I" style=relative patch=gm_violin
  def sub "Sub Bass" style=synth env=@{ a: 5ms, d: 1s, s: 100%, r: 50ms }
  def vox "Vocal Chops" style=concrete src="[https://example.com/vocal.ogg](https://example.com/vocal.ogg)"
  
  measure 1 {
    %% Acoustic: Inherited sticky-state and micro-timing
    vln1: c5:4.slur "Ah" d:8 e:4.tie e:8 |
    
    %% Synth: Continuous portamento frequency modulation
    sub: c2:2.glide(500ms) g2:2 |
    
    %% Concrete: Mathematical granular slicing
    vox: c4:4.slice(1) c4:4.slice(2) c4:4.slice(3) c4:4.slice(4) |
  }
}
```

-----

## 🗺️ Roadmap

  - [x] **Sprint 1:** T-MRL Core Parsing & Stateful Cursors
  - [x] **Sprint 2:** TSA Agentic Linter & Monaco LSP Integration
  - [x] **Sprint 3:** TEAS Engraving Engine (SMuFL, Skylines, Spring-Mass)
  - [x] **Sprint 4:** Addendum B (Native Web Audio DSP & Slicing)
  - [ ] **Sprint 5:** TEDP (Tenuto Execution & Delegation Protocol) — Bridging the web frontend to the Rust `tenutod` daemon for OSC SuperCollider routing and peer-to-peer Ableton Link synchronization.

-----

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.
