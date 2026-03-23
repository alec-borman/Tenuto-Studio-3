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

## 🎧 In‑Depth Audio Explanation

Listen to a detailed walkthrough of Tenuto 3.0, its architecture, and why it’s the definitive system of record for music.

[▶️ Click here to play the audio](https://alec-borman.github.io/Tenuto-Studio-3/demo.html)

If the player doesn’t load, you can also [⬇️ download the file directly](https://media.githubusercontent.com/media/alec-borman/Tenuto-Studio-3/main/Tenuto_3%20Deep%20Dive%20into%20Why%20it's%20important.m4a).

---

## ✨ Why Tenuto is What You’ve Been Looking For

### 🧠 For AI Researchers & Developers
- **Token‑efficient**: The stateful cursor and macros reduce source code by up to 90% compared to MusicXML, making it ideal for large language models.
- **Semantically rich**: Concepts like `slur`, `glide`, `slice`, and `pan` are first‑class citizens—the model learns musical intent, not just low‑level MIDI events.
- **Bidirectional translation**: Built‑in decompiler turns MIDI back into clean, idiomatic Tenuto, enabling data augmentation and fine‑tuning on massive existing datasets.
- **Extensible**: Custom attributes (`.x_`) and linter plugins let you adapt the language to new research directions without breaking the core.

### 🎹 For Composers & Arrangers
- **Write music, not markup**: `c4:4 d e f` is a C‑major scale. No angle brackets, no `<note>` tags.
- **Stateful cursor**: Omitted octaves and durations inherit from the previous event—the language stays out of your way.
- **Professional engraving**: SMuFL‑compliant, with beams, slurs, ties, lyrics, and multi‑page layout.
- **Export to MusicXML**: Print your scores in any notation software, or publish them as interactive web scores.

### 🎛️ For Producers & Sound Designers
- **Synthesizer built‑in**: `style=synth env=@{ a: 5ms, d: 1s, s: 100%, r: 50ms }` gives you a complete ADSR envelope.
- **Concrete sampling**: Load any audio file and manipulate it with `.slice(N)`, `.reverse`, and `.stretch`.
- **Live bus routing**: `src="bus://synth1"` routes the live output of one track into another—perfect for feedback loops and live resampling.
- **Per‑track FX chains**: Reverb, delay, and more, with dry/wet control, defined in the same text file.

### 💻 For Live Coders & Performers
- **Ableton Link integration**: Sync tempo and phase with other musicians, software, or hardware over the network.
- **OSC delegation**: Send events to SuperDirt or ChucK for advanced DSP.
- **Real‑time code injection**: The Rust daemon listens for new Tenuto code over WebSocket, allowing you to rewrite the score while it's playing.
- **Deterministic look‑ahead scheduling**: OSC bundles are timestamped with NTP, ensuring sample‑accurate execution even over Wi‑Fi.

### 🌐 For Web Developers
- **Zero‑friction runtime**: A single `<tenuto-score>` custom element or a simple JavaScript API embeds a full music engine in your page.
- **WebAssembly core**: The Rust compiler runs in the browser, giving you offline‑first capabilities and sub‑second compilation.
- **SharedArrayBuffer**: High‑performance communication between UI, WebGL, and audio threads, enabled by COOP/COEP headers.
- **Cache‑friendly**: Versioned assets allow you to set `immutable` headers, dramatically reducing bandwidth costs for sample libraries.

---

## 📜 The Language in Action

Here's a complete Tenuto file that demonstrates the breadth of the system:

```tenuto
tenuto "3.0" {
  meta @{
    title: "Olympia – Anthem of the Human Spirit"
    composer: "AI Master Composer"
    tempo: 88
    time: "4/4"
    key: "Eb"
  }

  %% Acoustic instruments
  def rh "Right Hand" style=relative patch=gm_piano
  def lh "Left Hand"  style=standard patch=gm_piano

  %% Synthesizer with ADSR envelope
  def sub "Sub Bass" style=synth env=@{ a: 5ms, d: 1s, s: 100%, r: 50ms }

  %% Concrete sampler with bus routing
  def glitch "Glitch FX" style=concrete src="bus://rh" map=@{ capture: [0s,4s] }

  measure 1-4 {
    rh: <[
      v1: [eb5 g5 bb5 eb6]:2..f eb6:32 f6 g6 ab6 bb6 c7 d7 eb7 [g6 bb6 eb7 g7]:2.marc
      v2: r:2
    ]>

    lh: eb1:4.mp [bb1 eb2 g2]:2.

    sub: c2:2.glide(500ms) g2:2

    glitch: capture:1.slice(4).reverse
  }

  measure 5-8 {
    meta @{ tempo: 100, text: "Maestoso" }

    rh: <[
      v1: [c6 eb6 ab6 c7]:2..f [bb5 d6 f6 bb6]:8
      v2: c4:4.grace d4 e4 f4
    ]>

    lh: eb1:4.p [bb1 eb2 g2]:4 d1:4 [bb1 d2 f2]:4

    sub: c2:1

    glitch: capture:1.slice(2).reverse.pan([-1.0,1.0],"linear")
  }
}
```

When you compile this, you get:

- A **printed score** with slurs, dynamics, grace notes, and a tempo change.
- A **MIDI file** that faithfully reproduces the notes and micro‑timing.
- A **Web Audio rendering** with:
  - The right hand played by a sampled piano.
  - The left hand as a separate piano track.
  - A sub‑bass synthesizer with a 500ms glide between notes.
  - A glitch track that captures the live output of the right‑hand piano, slices it into two equal pieces, reverses them, and pans them from left to right.
- **Live performance** (if the daemon is running): Ableton Link sync, tempo changes broadcast to other Link peers, and OSC messages sent to SuperDirt for further processing.

All from a single, human‑readable text file.

---

## 🏗 Architecture: How It All Fits Together

Tenuto Studio is built on four interoperating components, each of which can be used independently:

| Component | Description |
|-----------|-------------|
| **T‑MRL** | The language compiler. Parses Tenuto source, performs semantic analysis, expands macros, unrolls repeats, and generates an Intermediate Representation (IR). |
| **TEAS** | The engraving engine. Uses SMuFL metrics, 1D skylines, and Bezier curves to render professional‑quality scores. Supports multi‑page layout, lyrics, beams, slurs, ties, and voltas. |
| **Zero‑Friction Runtime** | The Web Audio engine. Runs an `AudioWorklet` for low‑latency synthesis, loads SoundFonts, processes concrete samples, manages bus routing, and applies per‑track effects. |
| **TEDP Daemon** | The execution daemon. Written in Rust, it provides Ableton Link synchronisation, OSC output to SuperDirt/ChucK, and a WebSocket interface for remote code injection. |

All components are open‑source and can be embedded in larger applications. The frontend is a React/Vite app that brings them together in a visual editor.

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 18+ (for the frontend)
- Rust & Cargo (optional, for the decompiler and daemon)

### 1. Clone the Repository
```bash
git clone https://github.com/alec-borman/Tenuto-Studio-3.git
cd Tenuto-Studio-3
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build the WASM Backend (Recommended)
```bash
cd tenutoc
cargo install wasm-pack
wasm-pack build --target web --out-dir ../public/pkg
cd ..
```

### 4. Run the Development Server
```bash
npm run dev
```

Open `http://localhost:3000` – you'll see the editor with a default example. Edit the code and hear the result immediately.

### 5. (Optional) Run the Daemon for Live Features
```bash
cd tenutod
cargo run --release
```

Then in the app, click the **Link** icon to sync tempo, and switch to **Remote OSC** mode to delegate playback to the daemon.

---

## 🧪 Testing

Run the comprehensive test suite:

```bash
npm run test
```

The tests cover:
- Lexer and parser correctness
- Semantic analysis and linter rules
- Graph unrolling (repeats, voltas)
- Engraver layout and collision detection
- Audio event generation
- WebSocket communication with the daemon

---

## 🌍 Deploying to Production

Tenuto Studio is a static site (Vite + React + WebAssembly). Build it with:

```bash
npm run build
```

The output is in `dist/`. You'll need a web server that can serve the static files and set the following HTTP headers for `SharedArrayBuffer` support:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These headers are required for the audio worklet and the WebGL renderer to communicate efficiently. **Cloudflare Pages**, **Netlify**, and **Vercel** all allow you to configure these headers via a `_headers` file or platform‑specific configuration.

If you host large sample libraries, set long cache headers for versioned assets (e.g., `Cache-Control: max-age=31536000, immutable`) to minimise bandwidth costs.

---

## 📚 Documentation

- **Language Specification**: See [`TENUTO_SPEC.md`](TENUTO_SPEC.md) for the complete grammar, semantics, and conformance profiles.
- **API Reference**: For embedding Tenuto in your own projects, refer to the [TypeDoc documentation](https://yourusername.github.io/tenuto-studio/docs).
- **Examples**: The `examples/` folder contains ready‑to‑run Tenuto files showcasing every feature.

---

## 🤝 Contributing

We welcome contributions from musicians, developers, and researchers. Whether you want to fix a bug, add a new linter rule, improve the engraver, or extend the audio engine, please open an issue first to discuss.

- **Code of Conduct**: We adhere to the Contributor Covenant.
- **Development Setup**: See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed instructions.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🙌 Acknowledgements

Tenuto stands on the shoulders of giants:

- **SMuFL** – the Standard Music Font Layout, which provides the precise metrics for every glyph.
- **Tone.js** – the foundation for Web Audio timing and context management.
- **smplr** – elegant SoundFont loading.
- **monaco-editor** – the powerful code editor that powers the IDE.
- **rusty-link** – Ableton Link integration for Rust.
- **rosc** – OSC messaging library for Rust.
- **chumsky** – parser combinators that make the Rust compiler a pleasure to maintain.

---

## 🎯 The Vision: A CRM for Music

In a world where musical ideas are increasingly generated by AI, composed by humans, and performed by hybrid ensembles, we need a single source of truth that captures every nuance of intent. **Tenuto is that source.** It is a system of record that can be versioned, diffed, queried, and transformed—just like code.

We believe that Tenuto will become the de facto standard for musical representation in the AI age. Join us in building that future.

**Write music. Run it. Share it. All from a single text file.** 🚀
