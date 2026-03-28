# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Sprint 1.4 Parity**: Achieved absolute Vector Delta ($\Delta = 0.00$) between TypeScript Scaffolding and Rust Steel tracks.
- Ported `parseEuclidean` Bresenham logic to Wasm `tenutoc::parser`.
- Ported dot-chained modifiers and `.roll(n)` expansions to Wasm `tenutoc::preprocessor`.
- Refactored TypeScript `GraphUnroller` to mirror Wasm structural geometry, effectively eliminating leaky abstractions in the AudioWorklet physics layer.
