# Tenuto 3.0 Roadmap

This document outlines the remaining features required to achieve full compliance with the Tenuto 3.0 specification. Every feature listed here will be driven by a specific `.tela` sprint and tracked via vector delta.

## Remaining Features

### 1. Concrete Audio (`engine:concrete_audio`)
*   **Description:** Map raw audio buffers to alphanumeric keys. Execute granular slicing, time-stretching, and phase-vocoding natively.
*   **Priority:** High
*   **Effort:** Large
*   **Sprint:** `TENUTO-REMAINING-001`

### 2. Sidechain Ducking (`engine:sidechain_ducking`)
*   **Description:** Implement audio routing for sidechain compression and ducking effects directly from the AST.
*   **Priority:** Medium
*   **Effort:** Medium
*   **Sprint:** `TENUTO-REMAINING-002`

### 3. MusicXML Export
*   **Description:** Export the Tenuto IR to standard MusicXML format for compatibility with traditional notation software (Sibelius, Finale, Dorico).
*   **Priority:** High
*   **Effort:** Large
*   **Sprint:** `TENUTO-REMAINING-003`

### 4. Full SVG Engraving
*   **Description:** Complete the visual sheet music rendering engine, moving beyond the current placeholder implementation.
*   **Priority:** Medium
*   **Effort:** Large
*   **Sprint:** `TENUTO-REMAINING-004`

### 5. Decompilation
*   **Description:** Convert raw MIDI files back into semantic Tenuto code.
*   **Priority:** Low
*   **Effort:** Medium
*   **Sprint:** `TENUTO-REMAINING-005`
