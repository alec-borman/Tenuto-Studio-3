# Tenuto Studio 3

Tenuto Studio 3 is a comprehensive music notation and composition environment. It combines a custom domain-specific language (Tenuto) with a high-performance Rust-based compilation engine, real-time audio synthesis, and WebGL-accelerated visualization.

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
