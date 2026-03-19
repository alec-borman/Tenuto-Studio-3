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

*Tenuto: Write music as code. Compile to everything.*
