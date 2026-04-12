# Tenuto 3.0 Roadmap

This document outlines the remaining features required to achieve full compliance with the Tenuto 3.0 specification. Every feature listed here is driven by a specific `.tela` sprint and tracked via vector delta.

## Completed Sprints
* **[COMPLETED] TENUTO-REMAINING-001 (Concrete Audio):** Mapped raw audio buffers to alphanumeric keys. Executed granular slicing and time-stretching natively.
* **[COMPLETED] TENUTO-REMAINING-002 (Sidechain Ducking):** Implemented audio routing for sidechain compression and ducking effects directly from the AST using spacer tokens.
* **[COMPLETED] TENUTO-REMAINING-003 (MusicXML Export):** Exported the Tenuto IR to standard MusicXML 4.0 format, supporting strict polyphony routing.

## Active Sprint
* **[ACTIVE] TENUTO-REMAINING-004 (Full SVG Engraving):** 
  * **Description:** Complete the visual sheet music rendering engine, moving beyond the current placeholder implementation. This sprint will fully leverage the Cassowary layout engine for horizontal justification and Skyline arrays for vertical collision detection.
  * **Priority:** Medium
  * **Effort:** Large

## Upcoming Sprints
* **[PLANNED] TENUTO-REMAINING-005 (Decompilation):** 
  * **Description:** Convert raw MIDI and MusicXML files back into highly compressed, semantic Tenuto code using algorithmic reverse inference (LZ77 macro extraction, Euclidean reverse-engineering).
  * **Priority:** Low
  * **Effort:** Medium