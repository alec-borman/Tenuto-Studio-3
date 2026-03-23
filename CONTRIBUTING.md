# Contributing to Tenuto 3.0

Thank you for your interest in contributing to Tenuto! As the "System of Record" for music, we maintain exceptionally high standards for code quality, safety, and architectural integrity.

## Architectural Philosophy

**Strict Decoupling / Black Box Mindset**

Tenuto is built on a philosophy of strict decoupling. The core compiler (`tenutoc`) operates as a pure function: it takes source code as input and produces an Intermediate Representation (IR), MIDI, and SVG data as output. 

*   **No Leaky Abstractions:** The frontend must never assume the internal state of the Wasm compiler.
*   **Memory Safety:** The boundary between Rust (Wasm) and TypeScript is strictly typed. Memory allocated in Wasm must be explicitly freed.
*   **Immutability:** Treat the AST and IR as immutable data structures once generated.

## Testing Rules

All new features and bug fixes must be accompanied by rigorous testing.

1.  **Rust (Compiler Core):**
    *   Unit tests are required for all new parsing and compilation logic.
    *   **Property-Based Testing:** Use `proptest` for parsing and lexing to ensure the compiler can handle edge cases and malformed input without panicking.

2.  **TypeScript (Frontend & Tooling):**
    *   **TypeDoc Requirements:** All exported interfaces, classes, and functions MUST be documented using TSDoc comments. This is critical for maintaining the generated API documentation.
    *   Ensure strict typing across the Web Worker boundary (`CompilerRequest` and `CompilerResponse`).

## Zero-Warning Policy

We enforce a **Zero-Warning Policy** across the entire codebase.

*   **Rust:** Your code must compile with `cargo build` and `cargo clippy` with zero warnings. Unused variables, dead code, or unhandled `Result` types are not permitted.
*   **TypeScript:** Your code must pass `npm run lint` (TypeScript compiler checks) with zero errors or warnings.

Any pull request introducing warnings will be rejected.
