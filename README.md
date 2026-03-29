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

---
*Tenuto is open-source and maintained by the Tenuto Working Group.*
