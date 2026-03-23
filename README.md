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
- **Strict Decoupling / Black Box Mindset**: The core compiler (`tenutoc`) operates as a pure function. The frontend never assumes the internal state of the Wasm compiler, ensuring memory safety and immutability.

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

## 🚀 Quick Start

### Building the Project

The Tenuto Studio 3.0 core consists of a Rust-based compiler (`tenutoc`) compiled to WebAssembly, and a TypeScript frontend.

1. **Build the Rust Compiler (Wasm):**
   ```bash
   cd tenutoc
   wasm-pack build --target web --out-dir ../public/pkg
   ```

2. **Install Frontend Dependencies:**
   ```bash
   npm install
   ```

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```

## 📚 Documentation

*   **API Documentation:** Generated via TypeDoc. See the `docs/api` directory (generated during build).
*   **Manual Documentation:** Comprehensive guides and language specifications are available in the `/docs` folder.
