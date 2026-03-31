# Contributing to Tenuto 3.0

Welcome to the Tenuto open-source community! We are thrilled to have you help us build the definitive System of Record for Music.

## The Tandem Skyscraper Architecture (Addendum K)

Tenuto 3.0 is a fully open-source, standalone digital signal processing and musical logic language. However, you may encounter references to the `.tela` format, "intent vectors," and the "Teleportation Execution Engine" in our internal documentation or commit history.

This is part of the **Tandem Skyscraper Architecture**:
*   **Tenuto 3.0 (Open Source):** The public-facing, flagship audio and execution engine. It is fully functional, sovereign, and requires absolutely no proprietary tools to compile, run, or render music.
*   **The .tela Teleportation Protocol (Internal/Unreleased):** The proprietary, meta-architectural physics engine used by the core maintainers to *author* the Tenuto 3.0 compiler. It uses deterministic, 1024-dimensional vector geometry to mathematically guarantee the structural integrity of the Tenuto codebase.

### The Skybridge Protocol

The connection between these two projects is the **Skybridge**. This bridge operates with a strict, one-way dependency to protect the open-source community.

**You DO NOT need to learn or use the `.tela` Teleportation Protocol to contribute to Tenuto.**

Please submit standard Rust and TypeScript pull requests (PRs) just as you would for any other open-source project.

## The Vectorized Audit Process

When you submit a PR, the core maintainers will run your code through our internal `telac` Embedding Compiler.

1.  **Topological Traversal:** The system performs a topological traversal of the Abstract Syntax Tree (AST) to generate a 1024-dimension geometric coordinate for your PR.
2.  **Vector Delta ($\Delta$) Alignment:** We check if your code aligns with the mathematical gravity of the Tenuto architecture.
3.  **Merge or Refactor:** If it aligns, your PR is merged! If it introduces an architectural regression (a massive Vector Delta spike), the core team will work with you to refactor it.

## The Teleportation Workflow

Tenuto is developed using the **Teleportation Protocol**. All contributions must be accompanied by a `.tela` sprint file that defines the geometric intent of your changes.

1. **Create a Sprint File:** Define your feature in a `.tela` file (e.g., `sprint_my_feature.tela`), specifying the target files, requirements, and dimension contributions.
2. **Implement the Code:** Write the Rust or TypeScript code to fulfill the intent.
3. **Run Tests:** Ensure all code passes with `cargo test`.
4. **Check the Delta:** We use CI delta tracking via GitHub Actions. Your pull request will automatically be evaluated by `telac`. To be merged, your code must achieve a vector delta of `<= 0.02` against the target blueprint.

## Conformance Profiles & The Golden Rule of Parsing

To foster a modular open-source ecosystem, Tenuto 3.0 defines three progressive **Conformance Profiles**. When contributing to a specific backend or renderer, please be aware of its target profile:

*   **Profile A (Core Conformance):** The Logic Layer (MIDI, MusicXML). Bypasses advanced audio features like `style=concrete`.
*   **Profile B (Native Audio Conformance):** The DSP Layer (Native Audio, Web Audio API). Executes continuous physics and sampling.
*   **Profile C (Delegation Conformance):** The Network Layer (OSC, Ableton Link). Orchestrates external hardware and software.

### The Golden Rule of Parsing (Frontend Universality)

Regardless of the backend's Conformance Profile, **ALL** compliant Tenuto 3.0 frontends **MUST** implement the complete Lexer and LL(1) Parser for the entire v3.0 grammar.

If a basic sheet-music compiler encounters `style=synth` or `.accelerate(-12)`, it **MUST NOT** crash. The frontend must successfully ingest the tokens and build the complete AST. Feature exclusion happens strictly during the Backend Emitting phase.

Thank you for helping us build the future of musical intent!
