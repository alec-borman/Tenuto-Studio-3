# Tenuto Language Specification

**Version:** 3.0.0 (The Producer Update)

**Status:** Normative / Final

**License:** MIT

**Maintainer:** The Tenuto Working Group

## 1. Introduction & Architectural Philosophy

Tenuto is a deterministic, declarative domain-specific language (DSL) designed to serialize musical logic, instrument physics, and advanced digital signal processing (DSP) into a highly compressed, human-readable text format.

Historically, digital music systems forced a strict dichotomy: either the **Helmholtz model** of static, discrete pitches (represented by XML sheet music), or the **Schaefferian model** of manipulatable sound objects (represented by raw `.wav` files and DAW project graphs). **Version 3.0.0 unifies these paradigms.** It acts as a universal logic layer capable of generating mathematically perfect Sheet Music (MusicXML), absolute performance data (MIDI 2.0), or rendering directly to audio via native DSP translation.

### 1.1 The Four Core Design Principles

1. **Inference Over Redundancy (The Stateful Cursor):** Musical notation is inherently sequential and repetitive. XML-based formats (MusicXML, MEI) exhibit catastrophic verbosity by explicitly declaring tags for every parameter of every note. Tenuto defeats this using a strict **Sticky State** cursor. Parameters such as duration (`:4`), octave (`4`), and amplitude (`.ff`) persist in the compiler's memory until explicitly mutated. This achieves up to a **90% reduction in token count**, massively optimizing the format for Large Language Model (LLM) context windows.
2. **Strict Ontological Separation:** Tenuto isolates the "Physics" of an instrument (its tuning array, ADSR envelope, sample map, and hardware routing) from the "Logic" of the performance (the rhythms, pitches, and micro-timing).
3. **Absolute Mathematical Truth (Rational Time):** DAWs rely on arbitrary PPQ (Pulses Per Quarter Note) grids. Evaluating irrational rhythms on an integer grid inherently causes IEEE 754 floating-point quantization drift. The Tenuto inference engine evaluates all time using **Rational Arithmetic** (P/Q). Time is stored as perfect fractions in the Intermediate Representation (IR) and only coerced into physical ticks at the final microsecond of rendering.
4. **Electronic & Acoustic Parity [v3.0]:** Abstract DSP manipulations—such as time-stretching, sidechain ducking, granular slicing, and 808 portamento glides—are elevated to semantic musical primitives, accessible via the same elegant, dot-chained syntax used for classical articulations (`.stacc`).

### 1.2 The Compilation Pipeline

A compliant Tenuto compiler **MUST** implement a rigid 6-stage transformation architecture:

1. **Lexing ($O(n)$ DFA):** Tokenization using maximal-munch algorithms and compound sigils.
2. **Parsing (Deterministic LL(1)):** Generating the Abstract Syntax Tree (AST) utilizing strict lookahead peek-guards to eliminate infinite recursion and backtracking.
3. **Preprocessing (Expansion):** Resolving the Symbol Table, applying `$macros`, injecting `$variables`, and executing cross-file `import` directives.
4. **Inference (IR Linearization):** Traversing the AST to resolve the Stateful Cursors, executing rational tuplet math, and projecting relative events onto an absolute timeline.
5. **Visual Translation (Rebarring/Spelling):** Slicing absolute time into discrete visual measures and deriving diatonic pitch spellings via the Line of Fifths.
6. **Emitter Backends:** Serializing the fully resolved IR into targeted protocols (MIDI, MusicXML, JSON, or direct audio buffers).

### 1.3 Conformance & Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.
This is exactly how a professional, industry-standard language specification handles scope creep. By formalizing this section, you protect the AI's ability to "think" in advanced concepts while protecting the compiler developer from having to build a DAW from scratch.

Here is the formal draft for **Section 1.4** to insert directly into your specification's Introduction.

---

### 1.4 Conformance Profiles & Graceful Degradation

Because Tenuto 3.0 spans the absolute limits of discrete visual notation and continuous digital signal processing, it is not strictly necessary for every implementation to support all rendering targets. To foster a modular open-source ecosystem, the Tenuto Working Group defines three progressive **Conformance Profiles**.

Compiler authors **MUST** clearly declare their supported profile.

#### 1.4.1 The Golden Rule of Parsing (Frontend Universality)

Regardless of the declared Conformance Profile, **ALL** compliant Tenuto 3.0 compilers **MUST** implement the complete Lexer and LL(1) Parser for the entire v3.0 grammar.

If an AI or composer writes a `style=synth` track with `.accelerate(-12)` pitch dives, a basic sheet-music-only compiler **MUST NOT** crash or throw a fatal `E1000` Syntax Error. The frontend must successfully ingest the tokens and build the complete Abstract Syntax Tree (AST). Feature exclusion happens strictly during the Backend Emitting phase.

#### 1.4.2 Profile A: Core Conformance (The Logic Layer)

This is the minimum viable implementation required to be considered a Tenuto 3.0 Compiler.

* **Required Features:** * The Stateful Cursor (Sticky State).
* Rational Temporal Engine (Tuplets and Euclidean `(k):3/8`).
* Polyphonic Voice Isolation (`<[ ]>`).
* Micro-timing math (`.pull`, `.push`) applied to absolute tick execution.


* **Required Targets:** MIDI 1.0 (or 2.0) and/or MusicXML 4.0.
* **Degradation Behavior:** A Profile A compiler encountering `style=concrete`, `style=synth`, or advanced audio attributes (e.g., `.slice`, `sidechain`) **SHALL** bypass those AST nodes during the emitting phase and output a non-fatal warning:
* `W4001: Unsupported Extended Feature. Track 'vox' utilizes 'style=concrete', which is bypassed in Profile A compilers.`


#### 1.4.3 Profile B: Native Audio Conformance (The DSP Layer)

Compilers implementing Profile B function as standalone audio-rendering engines.

* **Required Features:** All Profile A features, plus native execution of `style=concrete` (audio buffer slicing, `.stretch`) and `style=synth` (ADSR envelopes, continuous portamento interpolation).
* **Required Targets:** Native audio file generation (`.wav`, `.flac`) or direct browser Web Audio API execution (Wasm).
* **Degradation Behavior:** If a track utilizes `style=chuck` or external OSC delegation, a Profile B compiler safely warns and bypasses the external routing.

#### 1.4.4 Profile C: Delegation Conformance (The Network Layer)

The most advanced implementation tier, designed for live-coding and external hardware orchestration.

* **Required Features:** All Profile A and B features, plus network protocol implementations.
* **Required Targets:** OSC (Open Sound Control) bundle transmission to external runtimes (e.g., SuperCollider, TidalCycles) and peer-to-peer phase synchronization via Ableton Link.

## 2. Lexical Structure & Tokenization

To ensure sub-millisecond compilation speeds and strict LL(1) parsing, the Tenuto Lexer must natively trap and resolve domain-specific musical strings before they reach the parser.

### 2.1 Character Set, Encoding, & Whitespace

* **Encoding:** Source files **MUST** be encoded in **UTF-8**.
* **Case Sensitivity:** **Keywords** (`def`, `measure`, `meta`) and **Note Names** (`c4`, `F#5`) are **Case-Insensitive**. **Identifiers** (Staff IDs, Macros, Variables) and **String Literals** are **Case-Sensitive**.
* **Comments:** Denoted by a double percentage sign `%%`. C-style comments (`//` or `/*`) are strictly invalid.

### 2.2 Operators & Compound Sigils

Tenuto relies on strict compound sigils to mathematically differentiate structural scopes from internal data arrays, eliminating the "Metadata Trap."

| Sigil | Formal Name | Compiler Application |
| --- | --- | --- |
| `{` `}` | **Structural Braces** | Defines compilation phases, global scopes, and macro definitions. |
| `<[` `]>` | **Voice Brackets** | Triggers the Polyphonic Engine. |
| `@{` `}` | **Map Sigil** | Triggers Key-Value Dictionary parsing (Metadata, physics parameters). |
| `[` `]` | **Chord/Array Brackets** | Unrolls multiple discrete pitches into simultaneous atomic events, or defines arrays. |
| `:` | **Assignment / Ratio** | Binds logic to Staff IDs (`vln:`), explicitly denotes metrical duration (`:4`), or defines Tuplet/Euclidean limits. |
| `.` | **Attribute Dot** | Accessor for chaining sequential DSP modifiers (`.stacc.vol(80).stretch`). |
| `$` | **Invocation Dollar** | Signals the Preprocessor to evaluate the Symbol Table for macros/variables. |

### 2.3 Literals & Domain-Specific Primitives

The Lexer **MUST** prioritize the following regex boundaries:

| Type | Regex Boundary Pattern | Semantic Evaluation |
| --- | --- | --- |
| **Integer** | `[0-9]+` | Parsed as `i64`. |
| **Float** | `[0-9]+\.[0-9]+` | Parsed as `f64`. |
| **StringLit** | `"(?:[^"\] | \.)*"` |
| **PitchLit** | `(?i)[a-g](?:qs|qf|tqs|tqf|bb|x|#|b|n)*(?:[0-9])?(?:[+-][0-9]+)?` | The fundamental unit of acoustic frequency. |
| **TabCoord** | `(?i)[0-9xX]+-[1-9][0-9]*` | Formatted strictly as `Fret-String`. |
| **TimeVal** | `[0-9]+(?:\.[0-9]+)?(?:ms|s|ticks)` | **[v3.0 NEW]** Absolute physical time units. Used in `style=synth` envelopes and micro-timing offsets. |
| **Attribute** | `\.[a-zA-Z_][a-zA-Z0-9_]*` | Captures chained method names (e.g., `.roll`, `.ghost`). Bypasses standard identifier rules by requiring the leading dot. |
| **Identifier** | `[a-zA-Z_][a-zA-Z0-9_]*` | User-defined nomenclature for Variables, Macros, and Staff mappings. |



## 3. Document Structure & The Absolute Grid

A well-formed Tenuto document represents a fully encapsulated unit of musical physics and logic enforcing a **Declaration-Before-Use** policy.

### 3.1 The Root Block & Versioning

The outermost scope of any file **MUST** be enclosed in a `tenuto` block declaring the specification version.

```tenuto
tenuto "3.0" {
  %% Internal Scopes
}

```

* **Compiler Fallback Rule (Graceful Degradation):** If a v3.0 compiler encounters `tenuto "2.1"` or `tenuto "2.2"`, it **MUST** load the corresponding legacy parsing matrix. This ensures that v2.2.0 Continuous Control sweeps and Voice Brackets execute perfectly, while safely ignoring or warning against unmapped v3.0 features (like `TimeVal` primitives or `style=concrete`) if they are illegally used in older syntax versions.

### 3.2 Phase 1: Configuration (`meta`)

Establishes the global constants of the physical space using the Map Sigil (`@{}`).

**Syntax:** `meta @{ key: value, ... }`

| Key | Expected Type | Execution Behavior |
| --- | --- | --- |
| `title` / `composer` | String | Written to global AST headers. |
| `tempo` | Integer / Array | `120` sets static BPM. `[120, 140, "exp"]` creates an exponential automation curve. |
| `time` | String | Dictates the absolute tick capacity of the Measure Grid (e.g., `"4/4"`). |
| `key` | String | Initializes the spelling engine's Accidental State Machine. |
| `swing` | Integer / Map | **[v3.0]** Applies a localized micro‑timing algorithm. An Integer (e.g., `66`) applies a global swing percentage to all subdivisions. A Map enables grid‑specific swing depths, e.g., <br>

<br> `@{ 8: 66, 16: 54 }` applies a heavy 66% swing to eighth notes, but a lighter 54% swing to sixteenth notes. |
| `sidechain` | Map | **[v3.0]** Establishes global signal ducking routes (Detailed in Section 12). |

### 3.3 Phase 2: Definition (`def`)

Registers the physics of an instrument in the Global Symbol Table. An identifier (e.g., `vox`) **MUST** be defined here before it can be referenced. Referencing an undefined ID triggers a **Fatal Error (E2001)**. *(Detailed in Section 4).*

### 3.4 Phase 3: Logic (`measure`) & Additive Merging

The `measure` block encapsulates the timeline events on an **Absolute Time Grid**.

**Syntax:** `measure [Range] { ... }`

* **Explicit Mapping:** `measure 1 { ... }` targets the first chronological box.
* **The Additive Merge Rule:** If `measure 1` is populated in a piano scope, and subsequently `measure 1` is invoked in a drum scope, the Inference Engine **MUST** mathematically snap the start-tick of the drum logic to the exact same absolute timestamp as the piano logic.

### 3.5 Cross-File Aggregation (`import`)

**Syntax:** `import "filepath.ten"`

## 4. Instrument Definitions (The Physics)

Tenuto enforces a rigorous ontological barrier between the physical parameters of an instrument (its constraints, DSP chains, and hardware routing) and the musical intent applied to it. The `def` statement acts as a constructor, registering a new Staff ID into the compiler’s Global Symbol Table and dictating which internal Cognitive Engine the compiler invokes when evaluating that staff's logic.

**Syntax:** `def [ID] [Label] [Attributes]`

* **ID:** An alphanumeric identifier (e.g., `vox`, `sub_808`, `vln_I`). It **MUST** be unique within the Global Namespace.
* **Label:** A String literal (e.g., `"Lead Vocal"`). Utilized by the Visual Exporter for staff grouping labels and the DAW Exporter for MIDI track naming.
* **Attributes:** Space-separated `key=value` pairs. Complex configurations **MUST** utilize the Map Sigil (`@{ }`).

### 4.1 Staff Styles (The Cognitive Routing Engines)

The `style` attribute is mandatory. It determines the underlying semantic parser and the intermediate representation (IR) projection rules for the track:

1. **`style=standard`:** The Helmholtz Model. Parses Scientific Pitch Notation (`c4`, `ebqs5`). Inherits classical transposition rules and Elaine Gould's accidental state machines.
2. **`style=tab`:** The Physical Model. Parses spatial coordinates (`0-6`). Requires a `tuning` array. Mathematically derives absolute pitch via the Inverse String Rule.
3. **`style=grid`:** The Discrete Trigger Model. Parses arbitrary alphanumeric keys mapped to specific MIDI triggers via a `map=@{}` dictionary. Used for standard percussion.
4. **`style=concrete` [v3.0 NEW]:** The Schaefferian Model. Bypasses MIDI synthesis entirely. Maps alphanumeric keys to absolute physical timestamps of an external binary `.wav` file, evaluating stretch, slice, and granular algorithms in the audio backend.
5. **`style=synth`[v3.0 NEW]:** The Continuous Frequency Model. Treats pitch not as discrete events, but as a continuous frequency function. Configures global ADSR envelopes, LFOs, and portamento glide limits.

### 4.2 Comprehensive Attribute Reference

| Attribute | Valid Styles | Expected Type | Description & Compiler Execution Behavior |
| --- | --- | --- | --- |
| **`style`** | All | Enum | **REQUIRED.** Routes the AST nodes to the correct IR solver. |
| **`patch`** | All | String | SoundFont ID, General MIDI name (`"gm_piano"`), or VST path. Emits an absolute Tick-0 MIDI Program Change. |
| **`transpose`** | `standard` | Integer | Visual semitone offset (e.g., `-2` for Bb Clarinet). Alters visual spelling; IR absolute pitch remains strictly concert pitch. |
| **`tuning`** | `tab` | Array | Open string pitches (Low to High). Generates the $O(1)$ lookup table for coordinate-to-pitch derivation. |
| **`map`** | `grid`, `concrete` | Map | Binds tokens to execution data. E.g., `map=@{ k: 36 }` (MIDI Grid) or `map=@{ hook: [0.0s, 1.5s] }` (Concrete Audio). |
| **`src`** | `concrete` | String | Local file path or URI to binary audio. Informs the render backend to preload audio into RAM before compilation. |
| **`env`** | `synth` | Map | Global ADSR parameters utilizing `TimeVal` primitives. E.g., `env=@{ a: 10ms, d: 500ms, s: 100%, r: 0ms }`. |
| **`cut_group`** | `synth`, `concrete` | Integer | Monophonic choke grouping (e.g., `cut_group=1`). If two instruments share an ID, an attack on one instantly triggers a physical NoteOff on the other, preventing phase cancellation. |
| **`keyswitch`** | `standard` | Map | Translates semantic articulations (e.g., `pizz`) into a silent, 1-tick pre-roll MIDI trigger note (e.g., `@{ pizz: 24 }`). |



## 5. The Event Engine: Rhythm, Time & Micro-Timing

Tenuto manages auditory events upon a high-dimensional timeline. To achieve absolute mathematical truth while accommodating the fluid, unquantized "pocket" of modern electronic production, Tenuto 3.0 strictly bifurcates time into two tracking vectors within the `AtomicEvent` IR: **Logical Grid Time** and **Physical Playback Time**.

### 5.1 The Rational Temporal Engine (Logical Time)

Logical Time dictates exactly where a note sits on the printed page (MusicXML) and its mathematical relationship to the strict measure boundary.

* **The Syntax:** Duration is appended to an event via a colon (`:4`, `:16.`). Multipliers are appended via an asterisk (`* 4`).
* **The Mathematics of Drift Prevention:** Floating-point representations of time (e.g., $0.333333$) compound inaccuracies over thousands of events. The Tenuto compiler stores logical duration strictly as a `Rational` struct (Numerator / Denominator). A quarter note is mathematically $1/4$. A triplet eighth note is calculated algebraically: $1/8 \times 2/3 = 1/12$.
* **Late Resolution:** The IR only coerces these fractions into absolute scalar ticks (`u64`) at the exact moment of calculating the `AtomicEvent`, guaranteeing $0.00\%$ temporal drift across symphonies of any length.

### 5.2 Contextual Inference (The Stateful Cursor)

To eliminate XML-style redundancy, the IR traverses the AST using a Stateful Cursor memory block.

* **The Inference Rule:** If a duration is omitted from an event token (e.g., `c`), the compiler **MUST** inject the duration of the immediately preceding event within the same Voice/Staff scope.
* **Barline Penetration (Lenient Mode):** By default, stickiness persists seamlessly across absolute measure boundaries. (`measure 1 { c:4 } measure 2 { d e }` evaluates `d` and `e` as quarter notes).
* **Strict Boundary Reset (Strict Mode):** If the `--strict` compiler flag is enabled, the compiler **MUST** purge the sticky memory at every barline, defaulting to `:4` and `Octave 4`. This enforces explicit, self-contained coding practices necessary for archival generation.

### 5.3 Micro-Timing & "The Pocket" (Physical Time) [v3.0 NEW]

Modern beat-making relies heavily on "unquantized" grooves—snare drums that hit slightly late, or hi-hats that pull early. Hardcoding this into metrical duration destroys the ability to generate clean sheet music.

Tenuto 3.0 introduces Micro-Timing modifiers. These alter the **Physical Playback Time** (the absolute audio gate tick where the trigger fires) but leave the **Logical Grid Time** mathematically perfect.

* **Syntax:** `.push(TimeVal)` (Early/Anticipate) and `.pull(TimeVal)` (Late/Delay).
* **Execution via PPQ Ticks:** `.pull(15ticks)` shifts the physical execution 15 ticks late relative to the current PPQ resolution. This shift scales proportionally if the global tempo is dynamically automated.
* **Execution via Absolute Time:** `.pull(10ms)` shifts the execution exactly 10 milliseconds late, regardless of the track's BPM. The compiler algebraically calculates the required tick offset dynamically during the MIDI/Audio unrolling phase.

> *Note on Ticks:* The precise duration of a “tick” is relative to the compiler’s internal PPQ (Pulses Per Quarter Note) resolution. A compliant compiler **SHOULD** operate at a default resolution of **1920 PPQ**. Therefore, an offset of `15ticks` scales dynamically with the global tempo, whereas `15ms` represents absolute physical time.

* **Visual Immunity:** When exporting to MusicXML or SVG, the Rebarring Engine completely ignores `.push`/`.pull`, outputting a perfectly quantized, highly readable score.

### 5.4 Grace Notes & Atemporal Events

Grace notes are ornamental events that consume exactly $0$ metrical capacity in the measure grid.

* **Syntax:** `:grace`, `:grace.slash` (Acciaccatura), `:grace.noSlash` (Appoggiatura).
* **Execution:** The engine assigns the event a Logical Duration of `0` (bypassing measure capacity constraints entirely) but steals a fraction (typically $1/4$) of the parent note's **Gate Ticks** for physical playback.
* **Cursor Immunity:** Spec 5.4 dictates that Grace duration is **NOT sticky**. The state cursor retains the last "Real" rational duration, ensuring the note following a grace note inherits the correct structural rhythm.

## 6. The Pitch Engine

For acoustic instruments operating under `style=standard`, frequency data is encoded using a modified, highly optimized Scientific Pitch Notation (SPN) grammar.

### 6.1 The Reference Standard (Acoustic Physics)

To ensure centuries of archival durability, Tenuto's pitch ontology is grounded in rigid physics, not arbitrary software indexing.

* Unless explicitly overridden in the `meta` block via external Scala tuning maps, the token `a4` is normatively bound to exactly **440.0 Hz**.
* The compiler logarithmically derives all other pitches relative to this physical constant, tracking internal frequency states via `f64` precision before casting to integer MIDI boundaries (`69`).

### 6.2 Pitch Syntax & The Sticky Octave

**Syntax:** `[Step][Accidental?][Octave?]`

* **Step:** Diatonic steps `a` through `g` (Case-Insensitive).
* **Accidental:** `#` (Sharp), `b` (Flat), `x` (Double Sharp), `bb` (Double Flat), `n` (Explicit Natural).
* **The Sticky Octave:** Similar to duration, the octave integer persists in the State Cursor until explicitly mutated. `c4 d e f5 g` parses identically to `c4 d4 e4 f5 g5`.

### 6.3 Stateless Code vs. Stateful Layout (Gould's Rules)

In the raw Tenuto AST, an accidental is strictly stateless. Writing `f#4` means exactly one F-sharp. Writing `f4` immediately after implies an F-natural.

However, during Phase 5 (Visual Translation), the engine routes all pitches through an **Accidental State Machine** that rigorously enforces Elaine Gould’s *Behind Bars* engraving constraints:

1. **Measure Resets:** The accidental memory array is wiped clean at every absolute barline.
2. **Octave Isolation:** A written C♯4 does *not* apply to a C5 in the same measure. The state machine tracks memory independently per-octave array index.
3. **Cancellation (Natural Signs):** If the global Key Signature dictates F♯, and the compiler encounters an F natural (`f4`), the state machine registers a deviation from the baseline matrix and actively forces an `AccidentalDisplay::Explicit` instruction, ensuring an explicit `<accidental>natural</accidental>` tag is injected into the XML.

### 6.4 Polyphonic Chords & Forward-Looking Ties

* **Chords:** Simultaneous pitches are enclosed in brackets: `[c4 e g]:2`. The compiler unrolls these into discrete, parallel `AtomicEvent` structures sharing the exact same logical `start_tick` and `duration_ticks`. Sticky octaves evaluate sequentially *within* the chord from left to right.
* **Ties (`~`):** Placed at the end of a pitch (`c4~ c:8`). The IR processes ties using a **Forward-Looking Memory Queue**. The compiler registers the first `c4` as awaiting a tie. When it intercepts the second `c4`, it dynamically suppresses the new NoteOn generation, and instead mathematically extends the `duration_ticks` and `gate_ticks` of the *initial* event. This creates a mathematically seamless audio bridge while triggering the MusicXML `<tie>` generator.




## 7. Notational Attributes

Tenuto utilizes a rigid **Dot Notation** syntax to chain sequential metadata, DSP modifications, and graphical instructions to any valid Event.

### 7.1 Attribute Grammar & Execution

**Syntax:** `Event(:Duration)?(.Modifier)*` (e.g., `c4:4.stacc.vol(80).pull(5ms)`)

Modifiers are commutative regarding their semantic execution (the order of chaining does not affect the mathematical output), but the parser processes them sequentially into an `attributes: Vec<Attribute>` array. The compiler categorizes attributes to determine exactly how they alter the IR.

### 7.2 Category A: Amplitude & Dynamics (Sticky State)

Dynamics permanently alter the `last_velocity` integer of the active Cursor.

* **Tokens:** `pppp`, `p`, `mp`, `mf`, `f`, `ff`, `ffff`. (Mapped sequentially to integer velocities, e.g., `mf` = 80, `ff` = 112).
* **Custom Volume:** `.vol(N)` accepts an absolute 0-127 integer.
* **Persistence:** `c4:4.ff d e` ensures `c`, `d`, and `e` are all executed with high physical velocity, generating sequential `<dynamics>` tags in XML until the state is formally mutated.

### 7.3 Category B: Envelopes & Articulations (Transient)

Articulations modify the physical envelope (`gate_ticks`) of the specific event they decorate. They are isolated to the single event and do **not** persist.

* **`.stacc` (Staccato):** Multiplies the `gate_ticks` by $0.5$. The logical space remains perfectly intact, but the NoteOff physical trigger fires early.
* **`.stacciss` (Staccatissimo):** Multiplies `gate_ticks` by $0.25$.
* **`.ten` (Tenuto):** Overrides default release limits, stretching `gate_ticks` to exactly $1.0\times$ of the logical duration (Full Legato).

### 7.4 Category C: Timbre & Physical Directives

These instructions trigger `keyswitch` logic or alter the physical behavior of string/wind instruments.

* **Tokens:** `.pizz`, `.arco`, `.mute`, `.open`, `.harm`.
* **Execution:** These are **Sticky**. They inject a persistent state variable into the Track. For standard instruments, they emit silent, 1-tick MIDI keyswitch pre-rolls. For `concrete` instruments, they can trigger entirely different sample layers.

### 7.5 Extension Architecture (The User-Defined Namespace)

To guarantee archival stability as contemporary music and experimental DSP techniques evolve, Tenuto strictly reserves the `x_` namespace for user-defined attributes.

* **Syntax:** `.x_[Identifier](args)` (e.g., `.x_bowScrape`, `.x_granularJitter(0.5)`).
* **Behavior:** Compliant parsers **MUST** preserve `x_` modifiers in the AST. They **MUST NOT** throw errors or halt compilation if they cannot resolve them to known DSP macros. This guarantees infinite third-party plugin extensibility via the `tenutod` daemon without breaking the core parser compilation.

## 8. The Tablature Engine (`style=tab`)

The Tablature Engine abandons the acoustic frequency modeling of the Standard Engine in favor of strict, physical hardware coordinates. It captures the mechanical execution of fretted instruments and translates it into absolute pitch via high-performance, $O(1)$ array lookups.

### 8.1 Coordinate Grammar & The Inverse Rule

The fundamental unit of tablature data is the **Tab Coordinate**.
**Syntax:** `[Fret]-[String]` (e.g., `0-6`, `12-2`).

* **Fret:** An integer $0$ to $N$. The token `x` or `X` denotes a percussive "Dead Note" (indeterminate pitch, usually mapped to a specific muted articulation or velocity $0$ in the synthesizer backend).
* **String:** An integer $1$ to $N$.
* **The Inverse String Rule:** In standard fretboard nomenclature, String `1` always corresponds to the highest-pitched (physically thinnest) string. The compiler resolves this by indexing the instrument's `tuning` array (which is ordered strictly Low to High) using the formula:

$$Pitch = Tuning[TuningLength - String] + Fret + CapoOffset$$



### 8.2 Mechanical Techniques & Continuous Curves

Fretted instruments require dense microtonal manipulation. Tenuto parses these mechanical actions into mathematically calculated continuous data streams.

* **`.bu(Target)` / `.bd(Target)` (Bends):** Represents a continuous mechanical alteration of string tension. Targets accept float values representing whole-steps (e.g., `0.5` = half step, `1.0` = full step).
* *Execution:* The compiler dynamically calculates a high-resolution, 14-bit MIDI Pitch Bend curve. `.bu(1.0)` starts at the resolved center ($8192$) and interpolates to maximum bend ($16383$) over the exact metrical duration of the event. The engine automatically injects a Pitch Bend Reset immediately after the `NoteOff`.


* **`.sl` (Slide / Glissando):** Triggers portamento interpolation between two distinct spatial coordinates.
* **`.pm` (Palm Mute) & `.letring` (Laissez Vibrer):** Sticky timbre modifiers. `.letring` explicitly overrides the standard `gate_ticks` envelope, disabling `NoteOff` message generation for that pitch until a new chord is struck on the same strings.


## 9. The Percussion Engine (`style=grid`)

The Percussion Engine operates on a **Mapped Token System**. It abstracts complex, non-linear drum mapping into arbitrary, human-readable alphanumeric keys, decoupling the logic from arbitrary MIDI standards.

### 9.1 Token Resolution & The Hash Map

**Syntax:** `Key(:Duration)?(.Modifier)*`

The `Key` **MUST** exist within the instrument's `map` dictionary defined in Phase 2.

* *Example Definition:* `map=@{ k:[0, 36], s: [2, 38] }`
* *Execution:* The engine executes an $O(1)$ lookup. Intercepting `k`, it extracts the visual offset ($0$ lines from the staff bottom) and the physical MIDI execution integer ($36$). Unmapped keys trigger an immediate **Lookup Error (E901)**.

### 9.2 Universal Rudiments & Algorithmic Modifiers[v3.0 Updated]

While heavily utilized in the Percussion Engine, Tenuto 3.0 promotes rhythmic rudiments to **Universal Event Modifiers**. The `.roll(N)` and `.ghost` modifiers can be legally applied to *any* `style` engine (`standard`, `concrete`, or `synth`), allowing producers to apply rapid 32nd-note ratchets to hi-hats, vocal chops, or 808s universally.

* **`.roll(N)` (Tremolo / Ratchet):** Mathematically slices the event's duration into rapid sub-divisions.
* *Execution:* `s:4.roll(3)` divides a quarter-note duration by $2^3$ (8). The IR engine unrolls the single AST node into 8 discrete `AtomicEvent`s (32nd notes) in the absolute timeline, perfectly spacing their `tick` and `gate_ticks`. The MusicXML backend intercepts the `.roll(3)` attribute and outputs the corresponding `<tremolo>` triple-slash glyph to prevent visual clutter.


* **`.ghost` (Velocity Scalar):** A transient dynamic modifier. Applies an immediate $0.4\times$ scalar multiplier to the active `last_velocity` state integer, creating realistic, unaccented inner-groove hits without mutating the global sticky dynamic state.
* **`.flam` / `.drag`:** Injects 1 or 2 atemporal grace notes immediately preceding the primary absolute tick, stealing physical gate time from the prior event to simulate dual-stick impacts.

## 10. The Concrete Engine (Sampling) [v3.0 NEW]

Modern production heavily relies on the manipulation of raw audio waveforms (sampling). Standard DAWs manage this via opaque GUI stretch-markers and massive binary files. Tenuto 3.0 abstracts this into a purely semantic, token-efficient logic layer. *Note: Tenuto does not embed binary audio; it emits structural DSP instructions to the rendering backend.*

### 10.1 Physical Time Mapping

Users map absolute temporal slices of an external audio file to alphanumeric identifiers using the Map Sigil (`@{}`).

**Definition Syntax:**

```tenuto
def chop "Soul Sample" style=concrete src="break.wav" map=@{ 
  A:[0ms, 1500ms],   %% Maps key 'A' to the first 1.5 seconds of the audio
  B: [1500ms, 2200ms] %% Maps key 'B' to the subsequent 0.7 seconds
}

```

### 10.2 Granular Manipulation & Time-Stretching

Concrete events natively support DSP stretch modifiers to fit the DAW grid without altering acoustic pitch.

* **`.stretch`:** Instructs the compiler/audio-backend to apply a phase-vocoder (e.g., Élastique) to the mapped audio slice so its physical playback perfectly matches the specified logical metrical duration.
* *Example:* `chop: A:4.stretch` forces the 1500ms sample to mathematically compress or expand to perfectly fit the absolute tick-span of exactly one quarter note at the current global tempo.


* **`.slice(N)`:** The algorithmic granular chopper (inspired by TidalCycles). Instantly divides the mapped audio window into $N$ mathematically equal fragments.
* *Execution:* `chop: A:2.slice(8)` calculates the duration of fragment `A` ($D_p = 1500ms$). It divides $D_p$ by 8, emitting 8 sequential `AtomicEvent`s spaced equally across the logical duration of the half note (`:2`), attaching precise audio-buffer start/stop bounds to each event.


* **`.reverse`:** Emits a vector inversion command to the audio buffer reader.

## 11. The Synth Engine (Physics & ADSR) [v3.0 NEW]

The 808 bass and modern synthesizers operate on continuous frequency modulation and precise amplitude envelopes, which are poorly represented by classical discrete MIDI ticks. `style=synth` natively formalizes these continuous physics.

### 11.1 Declarative ADSR Envelopes

Global amplitude limits are configured via the `env` Map Sigil in the definition phase.

**Definition Syntax:**

```tenuto
def sub "808 Bass" style=synth env=@{ a: 0ms, d: 500ms, s: 100%, r: 0ms }

```

The compiler securely binds these parameters to the track's IR representation. Audio rendering engines **MUST** generate a corresponding amplitude envelope, strictly utilizing `TimeVal` primitives (`ms`, `s`) to guarantee absolute audio consistency regardless of the global BPM or temporal fluctuations.

### 11.2 Portamento & Continuous Glides

For trap basses and lead synths, continuous frequency modulation is handled via explicitly typed glide attributes.

* **Syntax:** `.glide(TimeVal)` or `.accelerate(Semitones)`
* **Execution (Portamento):** `c2:2.glide(150ms) c3:2` triggers the IR to interrogate the track's history. Detecting the previous pitch (`C2`), it mathematically calculates a continuous 14-bit MIDI Pitch Bend sweep from C2 up to C3 over exactly 150 milliseconds of real time.
* **Execution (Pitch Dives):** `.accelerate(-12)` creates a classic 808 pitch drop, emitting an array of tuning messages to sweep the pitch down exactly one octave across the precise metrical duration of the current note.

### 11.3 Monophonic Choke Groups

Sub-bass frequencies cannot overlap without causing destructive acoustic phase cancellation.

* **`cut_group = ID`:** Assigning an integer `cut_group` mathematically guarantees monophony. If the IR compiler detects a new `AtomicEvent` starting on a track with `cut_group=1`, it executes a sweeping function across the Timeline to terminate any active `gate_ticks` for *all* other tracks sharing `cut_group=1`. It forcefully injects a `NoteOff` command at that exact start tick, executing a perfect "Choke" mechanic.


## 12. Dynamic Signal Interaction (Sidechaining) [v3.0 NEW]

"Pumping" or ducking a signal (e.g., rapidly attenuating the volume of an 808 every time the kick drum hits) is mandatory in modern production. Tenuto 3.0 provides two mathematically deterministic methods for sidechain ducking, nullifying the need for convoluted DAW routing graphs.

### 12.1 Global Routing (The Mixing Desk Approach)

Sidechain compression relationships can be structurally defined in the global `meta` block. The compiler outputs these routes as overarching structural metadata to the execution DAW or Audio Engine.

**Syntax:**

```tenuto
meta @{ 
  sidechain: @{ 
    source: "drums.k",      %% The trigger (Track ID + Mapped Key)
    target: "sub",          %% The affected Track ID
    ratio: "8:1",
    threshold: "-20dB",
    release: "150ms"
  } 
}

```

### 12.2 Action Notation (The LFO Approach)

For total mathematical control without relying on external compression plugins, Tenuto utilizes its Polyphonic Voice Brackets (`<[ ]>`) and the **Spacer (`s`)** token to draw pure automation curves (LFOs) in parallel with the music.

* **The Spacer Token (`s`):** The spacer consumes logical timeline ticks but renders absolutely no visual ink (bypassing the XML Skyline engine). This allows for pure, invisible automation curves.

**Syntax & Execution:**

```tenuto
sub: <[
  v1: c2:1 |                                  %% The 808 note, held for a whole note
  v2: s:4.cc(7, [0, 127], "exp") * 4 |        %% The Sidechain: Volume ramps from 0 to 127 exponentially every quarter note
]>

```

The IR perfectly executes `v2` as a dense, high-resolution array of MIDI CC7 (Volume) messages. It rhythmically pumps the sub-bass volume parameter completely independent of the `v1` NoteOn triggers, yielding an explicit, automatable volume shaper coded in a single line of text.

## 13. Advanced Polyphony & Euclidean Topologies

Tenuto supports independent rhythmic streams within a single staff, essential for piano scores, drum sets, and complex electronic automation. Version 3.0 supercharges the polyphonic engine by bifurcating the Tuplet syntax to natively support Euclidean rhythm generation algorithms.

### 13.1 Voice Group Syntax & State Isolation

Polyphonic regions are structurally enclosed in the `<[ ]>` compound sigil. Distinct, parallel voices are separated by the pipe `|` character.

```tenuto
pno: <[
  v1: c5:4 d e f |  %% Melody
  v2: c3:1       |  %% Bass
]>

```

* **State Isolation (Inheritance vs. Sandbox):** `v1` (the primary voice) inherently imports the global sticky state (duration, octave, velocity) from the event immediately preceding the block. Secondary voices (`v2..v4`) are strictly sandboxed; their state cursors explicitly reset to physical defaults (`Octave 4`, `:4`, `mf`) upon entry to prevent the melody's pitch/time data from topologically corrupting the bassline or automation curve.
* **Strict Mode Synchronization:** To mathematically guarantee the stability of the measure grid, the compiler tracks the total logical duration consumed by each individual voice. If the `--strict` flag is enabled, the compiler enforces that *every* declared voice must sum to the exact same total absolute duration. A discrepancy of even a single tick triggers a fatal `E3002: Voice Sync Failure`.

### 13.2 Disambiguation: Euclidean vs. Polyrhythmic Tuplets [v3.0 NEW]

Modern electronic beats (e.g., trap, reggaeton, afrobeat) rely heavily on algorithmic, off-grid syncopation—distributing $K$ hits as evenly as possible across $N$ subdivisions. Tenuto 3.0 natively executes the **Euclidean Algorithm** $E(K, N)$ through a highly token-efficient overloading of the Tuplet syntax.

To prevent backwards-compatibility breakage with Tenuto v2.2, the deterministic LL(1) parser evaluates the *internal content* of the parentheses to route to the correct mathematical solver.

#### 13.2.1 The Standard Tuplet (Polyrhythm)

**Trigger:** The parentheses contain multiple space-separated events.
**Syntax:** `(Event Event Event...):P/Q`
**Execution:** Calculates a rational time scalar ($Q/P$) and applies it sequentially to all internal events. (e.g., `(c4:8 d e):3/2` compresses three 8th notes into the absolute duration of two).

#### 13.2.2 The Euclidean Tuplet (Algorithmic Distribution)

**Trigger:** The parentheses contain exactly **one** single event (no spaces).
**Syntax:** `(Event):K/N`

* **K:** The total number of identical hits (pulses) to generate.
* **N:** The total number of **equal time‑slots** into which the event’s overall logical duration is divided (the grid). The compiler distributes the *K* pulses as evenly as mathematically possible across these *N* steps.
**Execution:** `drums: (k):3/8` instructs the IR compiler to invoke a Bresenham line-drawing algorithm or equivalent Euclidean distributor. The compiler clones the single `k` event $K$ times (3), and maps it across an $N$-step grid (16th notes). It emits the classic `[X, ., ., X, ., ., X, .]` tresillo pattern directly into the absolute timeline, generated entirely from 8 characters of text.

## 14. Structure & Flow Control (The Graph Unroller)

Musical time is rarely strictly linear. Repetitions, alternative endings, and structural jumps (e.g., Da Capo) require a dedicated grammar to control both the **Visual Layout** (rendering bar lines) and the **Playback Execution Graph** (unrolling the timeline for audio generation).

### 14.1 Barlines & Global Synchronization

Explicit Bar Line tokens (`|`, `||`, `|:`, `:|`, `:|:`) denote structural boundaries, manually overriding the implicit bounds calculated by the Additive Measure Grid.

* **System-Global Scope:** Structural tokens are absolute system constraints. If the `vln` track defines a Repeat Start `|:` at Tick `7680`, the compiler strictly enforces this topological boundary on *all* active staves in the global system.
* **Conflict Detection:** If `vln` defines `|:` but `vlc` defines a standard `|` at the exact same absolute tick, the compiler detects a structural rupture and throws a fatal **Structure Mismatch Error (E3004)**.

### 14.2 The Execution Graph (Timeline Unrolling)

For accurate MIDI and Audio playback, the Inference Engine must computationally flatten a non-linear, looping score into a continuous 1-Dimensional timeline tape.

* **Standard Repeats:** Upon detecting a closed `|: events... :|` block, the compiler caches the internal `AtomicEvent` structures. It executes a deep clone, recalculates the `tick` offsets by adding the total absolute duration of the block, and splices the cloned events consecutively into the IR timeline.
* **Voltas (Alternative Endings):** Marked by brackets `[1. events... | 2. events... ]`. The compiler mathematically unrolls the graph via an iterative loop state. On pass 1, it executes bracket `1.` and jumps back to the repeat start tick. On pass 2, it conditionally bypasses bracket `1.` entirely, immediately executing bracket `2.`.

### 14.3 Navigation Anchors

* **Anchors:** `.segno` and `.coda` instruct the engine to cache the current absolute tick as `Target_Segno` and `Target_Coda` in the global Symbol Table.
* **Jumps:** Directives like `.ds_al_coda` (Dal Segno al Coda) instruct the Graph Unroller to execute a backward seek to `Target_Segno`, commence deep-cloning subsequent events, and halt the replication strictly upon evaluating the `.to_coda` attribute.


## 15. The Visual Translation Layer

The `Timeline` Intermediate Representation (IR) is a mathematically flawless, continuous stream of ticks and integer pitches. To output professional, human-readable sheet music (MusicXML or SVG), the compiler must translate this mechanical perfection back into physical typographical constraints.

### 15.1 The Rebarring Engine ("The Guillotine")

Visual music is organized into rigidly bounded physical boxes called measures. A 6-beat note cannot physically exist inside a 4-beat measure box.

* **The Measure Grid:** The engine evaluates the active Time Signature metadata (e.g., `4/4` = 7680 ticks) and generates a global absolute bounds array: `[0, 7680, 15360]`.
* **The Slicer:** If the absolute start and end ticks of an `AtomicEvent` straddle a grid boundary (e.g., a whole note starting on beat 4), the engine executes the Guillotine algorithm. It mathematically slices the single event into two distinct `VisualEvent`s precisely at the barline tick.
* **Tie Injection:** It automatically assigns the boolean `tie_start` to the first slice and `tie_stop` to the second, instructing the XML exporter to explicitly inject `<notations><tied type="start"/></notations>` tags to seamlessly connect the broken ink.
* **The Void Filler:** Visual measures must sum perfectly to their time signatures. If a measure is entirely empty, or if an event is delayed by micro-timing or standard rests, the algorithm calculates the exact tick deficit and dynamically injects explicit `<rest/>` events into the visual tree to satisfy layout padding constraints.

### 15.2 The Spelling Engine (Accidental State Machine)

Because `style=tab` and `style=grid` input methods bypass explicit note nomenclature, the engine must algorithmically derive whether a raw MIDI integer `61` should be written as C♯ or D♭.

* **The Line of Fifths:** The engine interrogates the active `Key Signature`. If MIDI 61 is non-diatonic to the key, it references a mathematically mapped Line of Fifths array, algorithmically preferring sharps in sharp keys (G, D) and flats in flat keys (F, Bb).
* **Elaine Gould's Rules:** The derived `SpelledPitch` is processed through a strict Accidental State Machine. It tracks memory independently per-octave, perfectly purges its memory array at every absolute barline, and forces the generation of explicit natural signs (`♮`) when a note explicitly cancels a previous accidental or the active key signature.

## 16. The Lyric Engine

Lyrics are treated as a parallel data stream mapped topologically to a specific Staff or Voice ID, guaranteeing the musical logic block remains completely uncluttered by dense text.

### 16.1 Parallel Assignment

Lyrics are injected using the `.lyric` string literal suffix.
**Syntax:** `Target_ID.lyric: "Text String"`

* Targeting `vln.lyric` implicitly maps the string sequence to the Primary Voice (`v1`) of the designated staff.

### 16.2 Syllabification & Mapping

The engine strictly tokenizes the UTF-8 string based on explicit delimiters, mapping the resulting syllables 1-to-1 onto the active pitch events of the target voice. The mapper automatically detects and ignores Rests (`r`) and atemporal Grace Notes (`:grace`).

| Mapping Token | Semantic Behavior | Visual Result (Typography) |
| --- | --- | --- |
| `     ` (Space) | Advance to next note. | Standard horizontal word spacing. |
| `-` (Hyphen) | Advance to next note. | Centered hyphen injected between the bounding boxes of the two notes. |
| `_` (Underscore) | Advance to next note. | Melisma extension line (SVG Spanner/XML tag) trailing the syllable. |
| `~` (Tilde) | **Stay on current note.** | Lyric slur (undertie) joining two distinct words onto a single physical pitch. |
| `*` (Asterisk) | Advance to next note. | Empty slot (No text rendered, consumes mapping index). |

* *Validation Constraint:* The compiler algebraically evaluates the total syllable count against the total viable `AtomicEvent` count in the target scope. Mismatches generate a compiler Warning (`W3006: Lyric Count Mismatch`), ensuring composers are alerted to broken alignments before exporting to publication layout.

## 17. Playback Control & Automation

Tenuto transitions abstract musical intent into dense physical control streams. While standard dynamics (`.ff`, `.p`) handle static velocity, Tenuto 3.0 introduces high-resolution interpolation for continuous control across the absolute timeline.

### 17.1 Continuous Control (CC) Sweeps

**Syntax:** `.cc(Controller_ID, [StartVal, EndVal], "Curve")`

* **Execution:** The Inference Engine evaluates the absolute tick duration of the event. It divides this temporal span into a high-resolution sub-grid (e.g., evaluating every 48 ticks) and generates a dense array of `TrackEventKind::Midi` control change messages.
* **Curve Types:** * `"linear"`: Constant rate of change ($y = mx + b$).
* `"exp"`: Exponential curve. Ideal for acoustic decibel/volume faders (`CC7` or `CC11`) to map accurately to human auditory perception.
* `"log"`: Logarithmic curve.


* *Example:* `c4:1.cc(11, [0, 127], "exp")` generates a mathematically perfect 4-beat MIDI Expression swell.

### 17.2 Tempo Geometry (The Time Map)

Tempo operates as a global metadata curve, dictating the mathematical conversion of absolute PPQ (Pulses Per Quarter) ticks into real-world microseconds during the final export.

* **Static Tempo:** `meta @{ tempo: 120 }` sets immediate BPM.
* **Ramped Tempo:** `meta @{ tempo: [120, 140], curve: "exp" }` instructs the Conductor Track to generate a continuous string of tempo meta-events over the exact metrical duration of the current measure.

### 17.3 Humanization & "The Pocket"

To prevent the sterile "Machine Gun Effect" inherent in sequenced electronic or orchestral mockups:

* **Syntax:** `meta @{ humanize: 0.05 }`
* **Execution:** Injects a randomized permutation algorithm into the IR compilation phase. Every `AtomicEvent` receives a Gaussian randomized variation ($\pm 5\%$) applied specifically to its physical `gate_ticks` start time and its `velocity`.
* **Safety:** This alters *only* the physical performance; the logical layout coordinates remain perfectly quantized for sheet music export.


## 18. Macros & Variables

To fulfill the mandate of **Inference Over Redundancy**, Tenuto relies on a robust Preprocessor to expand reusable logic and inject physical constants *before* AST Linearization.

### 18.1 Variable Declarations (Constants)

Variables store primitive data types (Integers, Floats, Strings, TabCoords, Maps) and are immutable within their scope.
**Syntax:** `var Name = Value`

* *Example:* `var snare_vol = 110`.
* *Injection:* Invoked via the `$` prefix (`sn.vol($snare_vol)`). The Preprocessor natively unwraps arrays and maps, making this invaluable for configuring global `style=synth` ADSR envelopes across multiple files.

### 18.2 Macro Definitions (Event Blocks)

Macros operate as compile-time text substitutions, allowing algorithmic parameterization of musical motifs.
**Syntax:** `macro Name(Arg1, Arg2=Default) = { Events... }`

* **Context Passing:** Attributes attached to a macro invocation (e.g., `$Motif(c4):16.stacc`) are systematically inherited by *every* valid child event generated by the macro's body during AST expansion.

### 18.3 Algorithmic Transposition Modifiers

Macros natively support algebraic transposition via the `+N` or `-N` suffixes.

* **Execution:** `$Motif(c4)+2` evaluates the expanded token stream, identifying all `PitchLit` elements. It passes them through a Scientific Pitch Notation shifter, raising the sequence by 2 semitones (e.g., to `d4`).
* **Safety:** The algorithm explicitly ignores `Rest`, `TimeVal`, and `Percussion` tokens, ensuring transposition never corrupts a drum pattern or duration modifier stored inside a macro.

## 19. File Organization & Module Linking

For large-scale symphonic or electronic productions, logic may be distributed across a massive dependency graph of smaller files.

### 19.1 The Import Directive

**Syntax:** `import "filepath.ten"`

* The Preprocessor **MUST** resolve the filepath relative to the active file's directory.
* **Global Symbol Table:** Any `def` or `var` statements inside the imported file permanently populate the Global Symbol Table for the host file.
* **Idempotency & Circularity:** The compiler **MUST** maintain an internal registry of hashed filepaths. Duplicate imports are safely ignored to prevent re-definition errors. Circular dependencies (A imports B, B imports A) are trapped by the Preprocessor and trigger an immediate **Fatal Error (E2004)**.

## 20. Advanced Engraving Controls

While Tenuto relies on its rendering engine to algorithmically deduce beaming and stem directions, professional scores require manual overrides to solve avant-garde visual topologies.

### 20.1 Manual Beaming & Stemlets

* **Explicit Beams:** `.bm` (Beam Start), `.bme` (Beam End), `.bmb` (Sub-beam Break).
* **Feathered Beams:** `.bm(feather_accel)` instructs the rendering engine's `SpannerId` to dynamically interpolate the Y-offset of secondary sub-beams across the X domain, resulting in a visually fanned accelerando graphic.
* **Stemlets:** Attached to rests (`r:8.stemlet`) to force the visual renderer to drop a short, un-headed stem to intersect an overhanging beamed group.

### 20.2 Cross-Staff Synchronization

**Syntax:** `Event.cross(Target_Staff_ID)`

* **Logical Ownership:** The event belongs strictly to the *Source Staff* for playback timing and sticky-state inheritance.
* **Visual Execution:** The rendering ECS injects an "Invisible Proxy Node" on the Source Staff (to preserve Cassowary horizontal constraints) but renders the physical notehead on the *Target Staff*, bridging the vertical gap with dynamic, auto-calculated "Knee Beams."

### 20.3 Invisible Alignment Nodes (Spacers)

* **`.hide` (Transparent Ink):** Consumes logical horizontal space and time, but renders with Opacity 0. Used for forcing precise lyric alignment or generating blank worksheets.
* **`.null` (Zero-Width Physics):** Consumes logical temporal ticks in the IR but registers a physical Rod constraint of exactly $0.0\text{ss}$ in the layout engine. Useful for anchoring text annotations at specific timestamps without physically displacing surrounding notes.

## 21. Ornamentation & Lines

Ornamentation tokens carry dual semantics: they instruct the visual engine to render specific SMuFL glyphs, and they instruct the IR engine to synthesize complex playback variations.

### 21.1 Atomic Decorators

* **`.tr` (Trill) / `.mord` (Mordent) / `.turn`:** * *Visual:* Injects standard SMuFL ornamentation glyphs (e.g., `ornamentTrill`) above the staff's Top Skyline.
* *Audio:* The MIDI backend mathematically unpacks the logical duration, dynamically alternating between the root pitch and the diatonic upper/lower neighbor based on the active `KeySignature`.



### 21.2 Connective Spanners

* **`.gliss` (Glissando) / `.port` (Portamento):** * *Visual:* Instructs the `kurbo` subsystem to route a continuous line or Bezier curve between the source note's $P_0$ anchor and the target note's $P_3$ anchor.
* *Audio:* Evaluated in the IR as a continuous Pitch Bend sweep or a mapped Portamento CC command across the gap between the two pitches.



## 22. Microtonality & Tuning Systems

Tenuto 3.0 supports Just Intonation, Xenharmonic scales, and global non-12TET mapping natively in both visual formatting and audio synthesis.

### 22.1 High-Resolution Accidental Syntax

* **Standard Tokens:** `qs` (+50 cents), `qf` (-50 cents), `tqs` (+150 cents), `tqf` (-150 cents).
* **Arbitrary Cent Override:** `c4+15`. The compiler explicitly adds a 15-cent offset.
* *Execution (Audio):* The compiler calculates the exact float ratio for MIDI Pitch Bend generation prior to the NoteOn event.
* *Execution (Visual):* The renderer places a text annotation (`+15`) precisely above the notehead.



### 22.2 External Tuning Maps (.scl)

To abandon standard equal temperament entirely, Tenuto supports industry-standard Scala files.
**Syntax:** `meta @{ tuning_file: "path/to/scale.scl", tuning_root: "a4" }`

* **Semantic Decoupling:** The written pitch in the source code (`c4 d e`) remains visually standard, generating clean, readable sheet music.
* **Audio Mapping:** The Inference Engine intercepts the linear diatonic steps and maps them to the exact logarithmic frequency ratios defined in the `.scl` file before outputting MIDI or Audio buffers, completely altering the harmonic landscape without corrupting the visual logic.

## 23. Visual Styling (The Theme Engine)

Tenuto natively divorces semantic data from visual presentation. A score's aesthetic layout is strictly governed by global parameters and local node overrides, allowing the exact same logic to compile into vastly different typographical styles without altering the source AST.

### 23.1 Theme Profiles

**Syntax:** `meta @{ theme: "ProfileID" }`

* `"standard"`: Traditional classical engraving (e.g., SMuFL Bravura). High-contrast, serif text fonts, rigid straight beams.
* `"jazz"`: Handwritten appearance (e.g., Petaluma). Employs ink-pen aesthetic stroke weights, "hand" fonts for annotations, and organically slanted lines.
* `"dyslexia"`: Automatically overrides standard text with OpenDyslexic fonts, expands the global `staff_space` unit by $1.5\times$ for extreme readability, and selectively applies color-blind-friendly palettes to intertwined polyphonic voices.

### 23.2 Node-Level Overrides

* **Color Syntax:** `Event.color("#FF0000")`. The layout engine applies the hex code to the Notehead, Stem, and associated Beams. It does **not** propagate to lyrics or annotations unless explicitly chained.
* **Notehead Mapping:** `Event.head("ShapeID")`. Instructs the Realization phase to bypass standard noteheads and fetch specific SMuFL variants (e.g., `head("x")` maps to `noteheadCross`, `head("diamond")` maps to `noteheadDiamondHarmonic`).
* **Scale Overrides:** `.cue` injects a local `scale_factor` (typically $0.7$) to the event, rendering it as a miniature cue note without fundamentally altering the global staff size.

## 24. Advanced MIDI & Hardware Automation

For complex orchestral sample libraries (Kontakt, Spitfire) or outboard analog hardware, Tenuto provides raw bit-level access to the MIDI protocol directly from the logic stream.

### 24.1 Articulation Keyswitches

To maintain human-readable scores, hidden trigger notes used for sample articulation switching are defined globally in the physics block:

```tenuto
def vln "Violin" style=standard keyswitch=@{ pizz: 24, legato: 25 }

```

* **Execution:** When `vln: c4:4.pizz` is evaluated, the Inference Engine automatically synthesizes a 1-tick, silent NoteOn/NoteOff sequence for MIDI Note `24` precisely before striking `c4`.

### 24.2 Hardware Channel & Bank Selection

* **Program Changes:** `Event.pc(ProgramNumber)` dynamically switches the active instrument patch mid-measure.
* **Bank Select:** `Event.bank(MSB, LSB).pc(ProgramNumber)` ensures seamless transition between deeply nested hardware synthesizer patches, emitting raw CC0 and CC32 pairs.
* **Aftertouch:** `.press(Value)` (Channel Pressure) and `.polypress(Value)` (Polyphonic Key Pressure) generate immediate pressure bytes matching the physical duration of the note.

## 25. Compiler Directives & Target Environments

Tenuto source code is frequently used as a "Single Source of Truth" that must compile out to multiple mutually exclusive targets (e.g., a printable PDF score vs. a heavily sidechained `.wav` audio render).

### 25.1 Conditional Compilation

**Syntax:** `if (Condition) { ... }`

* The compiler evaluates environment variables at pre-compile time.
* *Example:* ```tenuto
measure 1 {
if ($target == "audio") {
%% Sub-bass reinforcement: Invisible in sheet music, audible in the mix
sub: c2:1.vol(127) |
}
}
```


```



### 25.2 Debugging the AST

* **`.trace` attribute:** Attached to an event (`c4:4.trace`). Halts the AST parsing for that specific event and prints a complete memory dump of its Absolute Tick, Sticky State inherited values, and fully evaluated `SpelledPitch` to standard output.
* **Warning Control:** `meta @{ suppress:["E3002", "W1201"] }` selectively silences non-fatal compiler warnings for intentional deviations from standard music theory or polyphonic synchronization.

## 26. The Standard Library

To ensure maximum interoperability and reduce boilerplate, every compliant Tenuto compiler **MUST** implement the following Standard Library of constants. These identifiers are implicitly injected into the Global Symbol Table at compile-time.

### 26.1 Standard Tunings (`style=tab`)

Pre-defined Pitch Arrays for the `tuning` attribute (Ordered Low to High).

* `guitar_std`: `[40, 45, 50, 55, 59, 64]` (E2 to E4)
* `guitar_drop_d`: `[38, 45, 50, 55, 59, 64]`
* `bass_std`: `[28, 33, 38, 43]`
* `violin_std`: `[55, 62, 69, 76]`

### 26.2 Percussion Maps (`style=grid`)

Pre-defined Key Maps for standard acoustic drum mapping.

* **`gm_kit`**: Conforms exactly to the General MIDI Standard Channel 10 mapping.
* `k` (Kick - 36), `s` (Snare - 38), `ss` (Side Stick - 37)
* `h` (Closed Hat - 42), `ho` (Open Hat - 46), `ph` (Pedal Hat - 44)
* `t1`/`t2`/`t3` (Toms: High - 50, Mid - 47, Low - 43)
* `c` (Crash - 49), `r` (Ride - 51)


## 27. Error Reference Taxonomy

Tenuto strictly forbids silent failures or obscure panics. Compilers **MUST** utilize standard exit codes and provide context-aware, syntax-highlighted error spans mapped to these definitive codes.

### 27.1 1000-Series (Lexical & Syntax)

* **`E1001: Malformed Token`** - Unrecognized string sequences or prohibited C-style comments (`//`).
* **`E1002: Syntax Error`** - Unbalanced structural delimiters (`{`, `[`, `@{`, `<[`), orphaned brackets, or unexpected tokens.
* **`E1004: Version Incompatible`** - Target parser is older than the required `tenuto "X.X"` version declaration.

### 27.2 2000-Series (Scope & Symbol Table)

* **`E2001: Undefined Identifier`** - Referencing a Staff ID, `$macro`, or `$variable` before it is declared.
* **`E2002: Duplicate Definition`** - Re-declaring a reserved ID in the `def` or `var` phase.
* **`E2004: Circular Import`** - File A imports File B, which imports File A.

### 27.3 3000-Series (Logical & Temporal Synchronization)

* **`E3002: Voice Sync Failure`** - Triggered in `--strict` mode. Parallel voices within a `<[ ]>` polyphonic block do not sum to the exact same absolute tick duration.
* **`E3003: Tuplet Ratio Error`** - The mathematical capacity of a `(events):P/Q` block evaluates to an irrational or malformed length.
* **`E3004: Structure Mismatch`** - Conflicting global directives (e.g., Staff 1 declares a repeat `|:` at Tick 1920, but Staff 2 declares a standard barline `|`).

### 27.4 4000-Series (Physics & Parsing Limits)

* **`E4002: Invalid Type Cast`** - E.g., providing a String where an Integer duration is expected.
* **`E4005: Tie Target Not Found`** - A note requests a tie (`~`), but the `rebar` engine detects no identical pitch in the forward-looking temporal queue.

### 27.5 5000-Series (Preprocessor Escapes)

* **`E5002: Recursion Limit Exceeded`** - A macro expansion depth exceeded the compiler hard-limit (Standard: 64 iterations), terminating the process to prevent memory exhaustion attacks.

## 28. Implementation Guidelines

To ensure deterministic consistency across different operating systems and compiler forks:

1. **UTF-8 Normalization:** The compiler **MUST** normalize all identifiers and string literals to **Unicode NFC** (Normalization Form C) before parsing to prevent hash mismatch errors on visually identical variables.
2. **Rational Arithmetic Requirement:** Floating point numbers (`f32`/`f64`) **MUST NOT** be used to calculate temporal logic (durations, tuplets). Subdivision calculations must utilize explicit Numerator/Denominator structs until final integer tick resolution.
3. **The "Middle C" Rule:** Internal pitch derivations **MUST** anchor to Middle C (C4) as MIDI Note `60` (approx. 261.63 Hz).

## 29. Formal Grammar (EBNF)

This section provides the **Normative Syntax** of Tenuto v3.0 using Extended Backus-Naur Form (EBNF). It encompasses the v3.0 compound sigils, the `TimeVal` physical time parameters, and the bifurcated Euclidean tuplet syntaxes.

### 29.1 Lexical Tokens (Terminals)

```ebnf
IDENTIFIER  ::= [a-zA-Z_] [a-zA-Z0-9_]*
INTEGER     ::= [0-9]+
FLOAT       ::= [0-9]+ "."[0-9]+
STRING      ::= '"' [^"\\]* '"'
TIME_VAL    ::= INTEGER ("." INTEGER)? ("ms" | "s" | "ticks")

/* Domain Primitives */
PITCH_LIT   ::=[a-gA-G] ("qs"|"qf"|"tqs"|"tqf"|"#"|"b"|"x"|"n")* INTEGER? 
DURATION    ::= ":" INTEGER ("." INTEGER)? | ":grace" (".slash"|".noSlash")?
TAB_COORD   ::= [0-9xX]+ "-"[1-9][0-9]*
ATTRIBUTE   ::= "." IDENTIFIER

```

### 29.2 High-Level Structure

```ebnf
Score       ::= Header? TopLevel*
Header      ::= "tenuto" STRING? 
TopLevel    ::= Import | Definition | VariableDecl | MacroDef | Block | MetaBlock

Definition  ::= "def" IDENTIFIER STRING? DefAttr*
DefAttr     ::= IDENTIFIER "=" Value
VariableDecl::= "var" IDENTIFIER "=" Value
MacroDef    ::= "macro" IDENTIFIER "(" ParamList? ")" "=" "{" Voice "}"

Block       ::= Measure | Repeat | Volta
Measure     ::= "measure" (INTEGER | Range | List)? MetaBlock? "{" Logic* "}"
MetaBlock   ::= "meta" "@{" KeyValueList "}"

```

### 29.3 Logic & Event Stream

```ebnf
Logic           ::= Assignment | MetaBlock | Conditional
Assignment      ::= IDENTIFIER ":" (VoiceGroup | MultiVoiceBlock)
VoiceGroup      ::= Voice ("|" Voice)* "|"
MultiVoiceBlock ::= "<[" Voice ("|" Voice)* "]" ">"

Voice       ::= (Event | Tuplet | Euclidean | MacroCall)*

/* Note the inclusion of the 's' Spacer token for Action Notation */
Event       ::= (PITCH_LIT | Chord | TAB_COORD | "r" | "s" | IDENTIFIER) DURATION? Modifiers

Chord       ::= "[" (PITCH_LIT | TAB_COORD)+ "]"
Tuplet      ::= "(" Voice ")" ":" INTEGER "/" INTEGER
Euclidean   ::= "(" IDENTIFIER ")" ":" INTEGER "/" INTEGER
MacroCall   ::= "$" IDENTIFIER ("(" ArgList ")")? Transposition?

Modifiers   ::= (ATTRIBUTE ("(" ArgList ")")? | Tie)*
Tie         ::= "~"
Transposition ::= ("+" | "-") INTEGER

```

### 29.4 Data Structures

```ebnf
Map         ::= "@{" KeyValueList "}"
Array       ::= "[" Value ("," Value)* "]"
Value       ::= INTEGER | FLOAT | STRING | IDENTIFIER | TIME_VAL | Array | Map

```

## 30. Interoperability & Exchange

### 30.1 MusicXML 4.0 Mapping

* **The Guillotine:** Absolute-time events straddling measure boundaries map perfectly to sequential `<note>` elements tied across barlines via `<notations><tied type="start/stop"/></notations>`.
* **Polyphony:** Voice Brackets (`<[ ]>`) automatically inject sequential `<backup>` and `<forward>` tags matched strictly to `<voice>` identifiers to manage parallel playback inside the XML DOM.

### 30.2 MIDI 1.0 / 2.0 Mapping

* **Resolution:** Target files **SHOULD** utilize `1920 PPQ` formatting to preserve tuplets seamlessly.
* **Microtonality & Bends:** `qs`/`qf` and `.bu()` attributes evaluate to precise 14-bit `PitchBend` interpolations.
* **Percussion Routing:** Any definition utilizing `style=grid` or `patch="gm_kit"` is explicitly and automatically routed to MIDI Channel 10 (Index 9).

## 31. Reference Example (The v3.0 Producer Suite)

This comprehensive file serves as the ultimate validation target for the Tenuto 3.0 compiler, unifying Euclidean sampling, action-notation sidechain ducking, ADSR synthesizer physics, and advanced acoustic notation into a single, cohesive semantic matrix.

```tenuto
tenuto "3.0" {
  %% 1. GLOBAL CONFIGURATION
  %% Configures tempo, layout, and global sidechain ducking (Kick -> Sub Bass)
  meta @{ 
    title: "The Producer Suite", 
    tempo: 130, 
    time: "4/4",
    swing: 60,
    sidechain: @{ source: "drm.k", target: "sub", ratio: "8:1" }
  }

  %% 2. INSTRUMENT PHYSICS (Definitions)
  def pno "Keys" style=standard patch="gm_epiano"
  
  %% SYNTH: Native ADSR and monophonic choke groups
  def sub "808"  style=synth env=@{ a: 5ms, d: 1s, s: 100%, r: 50ms } cut_group=1
  
  %% GRID: Drum mapping
  def drm "Kit"  style=grid patch="gm_kit" map=@{ k: [0, 36], s: [2, 38], h:[4, 42] }
  
  %% CONCRETE: Granular audio sample mapping
  def vox "Vocal" style=concrete src="./vocals.wav" map=@{ a:[0.0s, 1.2s] }

  %% 3. PREPROCESSOR MACROS
  var base_vol = 90
  macro Motif(root) = { $root:8 d eb f }

  %% 4. LOGIC TIMELINE
  measure 1 {
    %% Keys: Polyphony with contextual sticky-state and microtonal bend
    pno: <[
      v1: $Motif(c5).vol($base_vol) g5:2.bu(0.5) | 
      v2: c3:1                                   | 
    ]>

    %% 808 Synth: Portamento glide and continuous pitch dive
    sub: c2:2.glide(150ms) c2:2.accelerate(-12) |

    %% Drums: Euclidean Hi-Hats (3 hits over 8 subdivisions), Ghost Snare, and Roll
    drm: (h):3/8 k:4 s.ghost k:8 s:8.roll(3) |
    
    %% Sampler: Granularly slice the 1.2s vocal sample into 4 equal rhythmic fragments
    vox: a:2.slice(4) r:2 |
  }
  
  measure 2 {
    %% Micro-Timing: Delay the snare physical playback by exactly 20 milliseconds
    drm: k:4 h:8 h s:4.pull(20ms) k:4 |
    
    %% 808 Synth: Action Notation Sidechaining
    %% Voice 1 plays the bass note. Voice 2 uses the Spacer ('s') to draw an invisible CC volume ducking curve!
    sub: <[
      v1: c2:1                               |
      v2: s:4.cc(7, [0, 127], "exp") * 4     |
    ]>
  }
}
```
# Addendum A: Ecosystem Integrations (The Universal Semantic Conductor)

**Version:** 1.0 (Extension to Tenuto 3.0.0)
**Status:** Normative / Final
**Scope:** SuperDirt (OSC) Backend, ChucK Delegation, Ableton Link Synchronization, and Live-Coding Transpilation.

## A.1 Architectural Philosophy
The Tenuto 3.0 language natively resolves the "Semantic Gap" between acoustic composition and modern electronic production. However, to maintain maximum token efficiency for AI generation and human readability, the Tenuto compiler (`tenutoc`) **MUST NOT** attempt to internally replicate the low-level digital signal processing (DSP) engines of highly specialized audio languages. 

Instead, compliant Tenuto runtimes **SHOULD** implement a **Delegation Architecture**. Tenuto acts as the master logic layer—calculating the absolute rational timeline and structural semantics—and dynamically orchestrates external physical engines (SuperCollider, ChucK) via Open Sound Control (OSC) and Ableton Link.

---

## A.2 The SuperDirt / SuperCollider Backend
SuperCollider provides unparalleled synthesis capabilities, while SuperDirt (the default audio engine for TidalCycles) provides a robust, pre-built framework for sample playback, Euclidean routing, and DSP effects. Tenuto utilizes SuperDirt as the primary native audio backend for the `style=concrete` and `style=synth` engines.

### A.2.1 OSC Translation & Look-Ahead Scheduling
To guarantee absolute, drift-free temporal playback, the Tenuto runtime daemon (`tenutod`) **MUST NOT** rely on local real-time `sleep()` triggers, which are prone to CPU jitter. 
*   **Protocol:** The compiler packages the linearized `AtomicEvent` structures from the Intermediate Representation (IR) into OSC bundles equipped with absolute NTP timestamps.
*   **Routing:** Messages **MUST** be routed to the SuperDirt listener (default UDP port `57120`) via the `/dirt/play` address.
*   **Look-Ahead:** The daemon **SHOULD** transmit bundles at least 200ms ahead of their physical execution time, allowing SuperCollider's internal server (`scsynth`) to render the DSP graph flawlessly.

### A.2.2 Normative Attribute Mapping (The Rosetta Stone)
The compiler translates Tenuto's semantic dot-chained attributes directly into SuperDirt's expected OSC parameters.

| Tenuto 3.0 Syntax | SuperDirt OSC Parameter | Compiler Execution Behavior |
| :--- | :--- | :--- |
| `style=concrete map=@{...}` | `s` (Sample folder) | Targets specific audio buffers loaded into SuperDirt RAM. |
| `:Duration` (Logical Time) | `sustain` | Mathematically scales the overall duration of the synthesis or sample envelope. |
| `.stretch` / `.slice(N)` | `speed` / `begin` / `end` | Translates rational tuplets into strict buffer playback bounds and rate adjustments. |
| `.glide(TimeVal)` / `.accelerate`| `accelerate` | Translates pitch dives (e.g., 808 drops) into SuperDirt's native parameter for continuous frequency modulation. |
| `cut_group=1` | `cut` | Triggers monophonic choke groups across the SuperDirt engine, silencing the previous event. |
| `meta @{ swing: 66 }` | `nudge` | Translates micro-timing grid displacements into absolute OSC timestamp offsets. |

---

## A.3 ChucK Delegation (`style=chuck`)
ChucK is a "strongly-timed" audio programming language that allows developers to write custom physical models and manipulate time on a sample-by-sample basis. Tenuto delegates the "micro-physics" of custom instrument design to ChucK while retaining macro-structural control.

### A.3.1 The `style=chuck` Engine
Composers or AI models can define external ChucK files (`.ck`) as instruments in the Tenuto Global Symbol Table.

**Definition Syntax:**
```tenuto
def phys_bass "Plucked String" style=chuck src="karplus_strong.ck"
```

### A.3.2 Shred Spawning and Concurrency
ChucK achieves concurrency through lightweight, user-level parallel processes called "shreds". When the Tenuto IR evaluates an event assigned to a `style=chuck` staff, it executes the following protocol:
1.  The Tenuto compiler fires an OSC trigger to the active ChucK Virtual Machine.
2.  The OSC message instructs the VM to dynamically `spork ~` a new shred of the designated `.ck` source file.
3.  Tenuto calculates the precise pitch (in Hz) and dynamic velocity (0.0 - 1.0 float), passing them as continuous arguments to the ChucK shred.

*Result:* The AI composes sweeping orchestral structures in highly efficient Tenuto code, while relying on the raw DSP power of ChucK to render individual, sample-accurate physical models in parallel.

---

## A.4 Ableton Link Synchronization
To facilitate live algorithmic performances (Algoraves) where a Tenuto-generating AI collaborates with human musicians using TidalCycles, Sonic Pi, or Ableton Live, Tenuto implements peer-to-peer network synchronization.

### A.4.1 Phase and Tempo Sync
The `tenutod` runtime daemon **MUST** integrate the Ableton Link open-standard API. Link converts between logical beats on a shared network timeline and the exact system clock time.
*   **The Shared Heartbeat:** The compiler's internal Measure Grid (defined in Section 15.1) calculates its absolute tick boundaries relative to the shared Link session phase, overriding local `meta @{ tempo: X }` declarations if Link is active.
*   **Quantized Injection:** If an AI dynamically generates and injects a new `measure` block during live playback, the Tenuto daemon aligns the start-tick over the shared bar boundaries, mathematically guaranteeing the AI's generation lands perfectly on the downbeat alongside human performers.

---

## A.5 Live-Coding Transpilation & Export
Because Tenuto acts as the universal logic layer bridging the "Semantic Gap", compliant compilers **SHOULD** support transpiling the deterministic AST directly into the syntax of specialized live-coding languages. 

### A.5.1 TidalCycles Export (`--target tidal`)
When exporting to TidalCycles, Tenuto algorithmically translates its Euclidean engines (Section 13.2) and Percussion maps into Haskell-based mini-notation.

**Tenuto Source:**
```tenuto
measure 1 {
  drm: (k):3/8 (s):2/8.pull(15ticks) |
}
```

**TidalCycles Transpilation Output:**
```haskell
d1 $ stack [
  sound "bd(3,8)",
  sound "~ sn ~ sn" # nudge "0.03"
]
```
*Implementation Note:* This 1:1 mathematical translation allows an AI to map complex architectural rhythm structures in native Tenuto, which a human live-coder can subsequently manipulate, reverse, or deform on the fly in TidalCycles.
To fix the exact shortcomings in the matrix—specifically **Ease of Adoption (2)** and **Standalone Utility (6)**—we have to solve the "Chicken and Egg" problem.


# Addendum B: The Zero-Friction Runtime (WebAssembly & DOM Integration)

**Version:** 1.0 (Extension to Tenuto 3.0.0)
**Status:** Normative / Final
**Scope:** Wasm Compilation, Web Audio API Fallback Execution, and HTML Custom Elements.

### B.1 Architectural Philosophy

Addendum A established Tenuto as the master logic controller for enterprise DSPs (SuperCollider, ChucK) via OSC. However, a universal standard cannot rely exclusively on the pre-installation of third-party, desktop-bound audio software.
Addendum B defines the **Embedded Web Runtime**. By compiling the `tenutoc` parser to WebAssembly (Wasm) and mapping the Intermediate Representation (IR) directly to the browser's native Web Audio API, Tenuto achieves 100% standalone utility. It allows any web developer to embed, generate, and play Tenuto scores natively in a web browser with zero external dependencies.

### B.2 The WebAssembly Compiler Target (`--target wasm`)

The core Rust `tenutoc` compiler **MUST** support a `wasm32-unknown-unknown` build target. This allows the entire lexing, parsing, and IR unrolling process to execute client-side within a standard JavaScript/TypeScript environment.

* **Token Efficiency in the Browser:** Because `.ten` files are fractions of a kilobyte, fetching and parsing Tenuto code over a network is exponentially faster than streaming flattened `.wav` or `.mp3` audio files.

### B.3 The Embedded Web Audio Execution Node

When the `tenutod` daemon is not present or OSC targets are unavailable, the Tenuto Web Runtime **SHALL** default to the native Web Audio API.

* **`style=synth` Fallback:** The runtime translates synth envelopes into native `AudioWorkletNode` oscillators and `GainNode` automations.
* **`style=concrete` Fallback:** The runtime fetches remote `.wav` URIs into native `AudioBufferSourceNodes`, utilizing Web Audio's exact `start(when, offset, duration)` scheduling to guarantee sample-accurate playback without temporal drift.

### B.4 The `<tenuto-score>` HTML Custom Element

To maximize Ease of Adoption, compliant Web Runtimes **SHOULD** expose an HTML Custom Element (Web Component). This allows web developers with zero audio-engineering experience to embed procedural music as easily as a standard image.

**Implementation Syntax:**

```html
<tenuto-score src="./soundtrack.ten" controls autoplay loop>
    Your browser does not support the Tenuto Web Runtime.
</tenuto-score>

```

### B.5 Local Client-Side AI Execution (WebGPU)

When a Tenuto script references an AI generative plugin (`src="plugin://ai-vocal-gen"`), the Web Runtime **MAY** intercept this URI and utilize WebGPU/ONNX.js to execute lightweight, quantized generative audio models directly in the user's browser, eliminating server-side inference costs and latency.

# Addendum C: Generative Ergonomics & Smart Compilation

**Version:** 1.0 (Extension to Tenuto 3.0.0)
**Status:** Normative / Final
**Scope:** Polyphonic Auto-Padding, Decoupled Control Lanes, and Relative Pitch Heuristics.

## C.1 Polyphonic Auto-Padding (E3002 Mitigation)

The standard Tenuto 3.0 compiler enforces strict mathematical synchronization across polyphonic voices (`<[ ... ]>`). If the total tick duration of $v_1$ does not equal $v_2$, the compiler throws a fatal `E3002: Voice Sync Failure`. While ideal for strict archival engraving, this strictness breaks linear, single-pass generative AI workflows.

### C.1.1 The `auto_pad` Directive

Compliant compilers **SHALL** support a global or local meta directive to relax this constraint.

**Syntax:**

```tenuto
meta @{ auto_pad_voices: true }

```

### C.1.2 Compiler Execution Behavior

When `auto_pad_voices` is enabled, the compiler intercepts the `]>` closure token and executes the following resolution logic:

1. Calculates the absolute maximum tick duration ($D_{max}$) across all voices within the block.
2. Identifies any voice ($v_i$) where its total duration ($D_i$) is less than $D_{max}$.
3. Automatically injects a terminal rest node `r` with a duration exactly equal to $(D_{max} - D_i)$ into the Abstract Syntax Tree (AST) for that voice.
4. Suppresses the `E3002` error and proceeds with IR unrolling.

## C.2 Decoupled Control Lanes (The Pedaling Track)

In traditional acoustic engraving, piano pedaling is often notated as a continuous line completely independent of the left-hand finger logic.

In Tenuto 3.0, chaining `.ped` to pitch events bloated the AST and made rhythm edits destructive to the pedaling logic. Addendum C introduces decoupled control lanes.

### C.2.1 The `pedal` Identifier

Within any polyphonic block or staff, composers **MAY** declare a `pedal:` lane. This lane does not generate acoustic pitch events; it exclusively maps logical durations to Continuous Controller (CC 64) execution commands.

### C.2.2 Syntax and Execution

The `pedal:` lane utilizes absolute durations to trigger state changes (`down`, `up`, `half`).

```tenuto
measure 1 {
    piano: <[ 
        v1:    [c3 g3 c4]:4.marc [f3 a3 c4]:8 [g3 b3 d4]:2 |
        pedal: down:4            up:8         down:2       | 
    ]>
}

```

**Compiler Behavior:** The compiler translates `down:4` into a MIDI CC 64 value of 127 at the start of the event, holding that state for exactly one quarter note before reading the next instruction. This allows an AI to map sweeping, syncopated pedal changes without interfering with the complex rhythmic generation of the pitch tracks.

## C.3 Relative Pitch Heuristics (`style=relative`)

The "Sticky State" architecture of Tenuto 3.0 assumes absolute octave retention. If a user writes `b4 c`, the compiler assumes `c4`, resulting in a massive downward leap of a Major 7th. To prevent AI context drift over long horizontal arpeggios, Tenuto introduces the Relative Pitch heuristic.

### C.3.1 The `style=relative` Declaration

Instruments can be instantiated with `style=relative` to alter the compiler's semantic inference engine.

**Syntax:**

```tenuto
def lead_synth "Lead" style=relative clef=treble

```

### C.3.2 The "Closest Interval" Rule

When compiling a `style=relative` track, if an event omits the octave integer (e.g., `c`), the compiler **MUST NOT** blindly inherit the previous octave integer. Instead, it **SHALL** calculate the absolute intervallic distance to the nearest matching pitch class.

**Execution Logic:**

* The compiler calculates the distance up and the distance down to the specified pitch class.
* The compiler assigns the octave integer that results in a leap of a **Tritone (6 semitones) or less**.
* If the leap is exactly a Tritone (e.g., `f` to `b`), the compiler defaults to the ascending interval.

**Example Comparison:**

```tenuto
%% Standard Mode (Absolute Sticky State)
%% Output: B4 -> C4 (Leaps DOWN a Major 7th)
standard_synth: b4:8 c:8 

%% Relative Mode (Smart Voice Leading)
%% Output: B4 -> C5 (Steps UP a Minor 2nd because it is the closest 'C')
relative_synth: b4:8 c:8 

```


# Addendum D: Deterministic Semantic Decompilation and Reverse Inference Pipeline

**Version:** 1.0 (Extension to Tenuto 3.0.0)
**Status:** Normative / Final
**Scope:** Algorithm-Assisted Semantic Decompilation, State Restoration, and Mathematical Intent Extraction from Explicit Machine Formats (MusicXML / MIDI).

## D.1 Philosophy of Reverse Inference

Traditional notation and audio interchange formats rely on explicit declaration—every note must exhaustively state its pitch, octave, duration, and velocity. When importing these bloated formats back into Tenuto, the **Semantic Decompiler** utilizes deterministic $O(n)$ algorithms, dictionary coders, and acoustic heuristics to reverse-engineer the composer's original intent.

The engine operates entirely offline within the Rust compiler. It actively hunts for mathematical patterns, physical instrument constraints, and structural redundancies, refactoring them into Tenuto's highest-level abstractions (Macros, Euclidean tuplets, Stateful Cursors, and Decoupled Control Lanes) without utilizing non-deterministic AI generation.

## D.2 The Reverse Inference Heuristics

Compliant decompilers **SHALL** execute the following 15 normative algorithmic passes to refactor machine translation into idiomatic Tenuto logic.

### D.2.1 Lexical Compression & State Restoration

**1. State Restoration (The "Diffing" Algorithm)**
Machine formats explicitly state the octave and duration of every note. The Decompiler maintains a virtual state cursor in memory and executes a strict differential pass. If a consecutive note shares the exact octave and duration parameters of the cursor, the redundant data **SHALL** be programmatically stripped to rely on Tenuto's Sticky State.

* **Machine:** `c4:4 d4:4 e4:4 f4:4`
* **Decompiled:** `c4:4 d e f`

**2. Relative Pitch Smoothing (The Tritone Heuristic)**
To prevent wild octave leaps during decompilation of flowing melodies, the engine calculates the absolute intervallic distance between adjacent pitch classes. If the leap is a tritone (6 semitones) or less, the engine safely drops the octave integer, utilizing Tenuto's `style=relative` logic.

* **Machine:** `b4:4 c5 d5 e5`
* **Decompiled:** `b4:4 c d e`

**3. Macro Extraction (LZ77 Dictionary Coding)**
The compiler scans the linear note stream using compression algorithms (e.g., LZ77) to identify recurring substrings. When an identical array of events is detected multiple times, it **MUST** be extracted, defined globally as a `$macro`, and referenced within the measure blocks.

* **Machine:** `measure 1 { c4:16 e g c5 } measure 2 { c4:16 e g c5 }`
* **Decompiled:** `macro Arp() = { c4:16 e g c5 } measure 1-2 { |: $Arp :| }`

### D.2.2 Temporal & Rhythmic Quantization

**4. Algorithmic Euclidean Reverse-Engineering**
Standard MIDI forces algorithmic beats into rigid sixteenth-note grids. The Decompiler counts the physical discrete hits ($K$) against the total grid slots ($N$) and runs the Bresenham line-drawing algorithm $E(K,N)$ in reverse. If the hit array perfectly matches the mathematical Euclidean output, the verbose data collapses.

* **Machine:** `k:16 r k r r k r` *(3 hits over 8 slots)*
* **Decompiled:** `(k):3/8`

**5. Micro-Timing & "The Pocket" Extraction (`.push` / `.pull`)**
The Decompiler establishes a mathematically perfect rational grid. If a physical note falls a discrete number of milliseconds ($t_{\Delta}$) ahead of this grid, the engine quantizes the logical note to the nearest clean fraction and appends the absolute delta as a physical modifier.

* **Machine:** `c4:64~ c:8...` *(floating-point drift)*
* **Decompiled:** `c4:4.push(15ms)`

**6. Polyrhythm Extraction (Greatest Common Divisor)**
Standard XML forces triplets into irrational tick lengths. The Decompiler utilizes GCD mathematics to find the precise integer ratio $\frac{P}{Q}$ of notes occupying a foreign grid space, wrapping them in a standard rational tuplet.

* **Machine:** `c4:2.666 d:2.666 e:2.666`
* **Decompiled:** `(c4:8 d e):3/2`

**7. Tremolo & Ratchet Compression (Repetition Division)**
When importing MIDI, drum rolls appear as dozens of discrete 32nd notes. The Decompiler divides the total tick span by the number of identical consecutive events. If it yields a perfect subdivision, it compresses the array into a single semantic modifier.

* **Machine:** `s:32 s:32 s:32 s:32 s:32 s:32 s:32 s:32`
* **Decompiled:** `s:4.roll(8)`

### D.2.3 Acoustic & Physical Execution Heuristics

**8. Syncopated Pedal Decoupling (Delayed CC64 Shift)**
Professional pianists use a delayed "syncopated pedal," lifting the pedal exactly as a new chord is struck and depressing it a split-second later. The Decompiler algorithmically identifies these delayed CC 64 events and realigns them into a clean, decoupled `pedal:` control lane synchronized with the logical downbeat.

* **Machine:** `[c4 e4 g4]:4 r:32 pedal_down:8...`
* **Decompiled:** `<[ v1: [c4 e g]:4 | pedal: down:4 ]>`

**9. Acoustic Mud Zone Abstraction (The C3 Boundary)**
Acoustic physics dictate that dense chords below C3 create muddy overtones. If the Decompiler detects dense closed chords below C3, it flags them; if it detects "open fifths" in the deep bass, it mathematically preserves their spacing to ensure a clean harmonic foundation.

* **Machine:** `[c2 g2 c3]:1`
* **Decompiled:** `<[ v1: r:2 c3:2 | v2: [c2 g2]:1.open_fifth ]>`

**10. Ergonomic Hand-Span Refactoring (Mind-the-Gap)**
The physical anatomy of the human hand dictates ergonomic limits. If the Decompiler encounters a chord spanning greater than a 10th (exceeding maximum static human reach), it **SHOULD** automatically refactor the static cluster into an arpeggiated spanner.

* **Machine:** `[c3 g3 e4]:4` *(Span of a 10th)*
* **Decompiled:** `[c3 g3 e4]:4.arp`

**11. Polychordal Stratification**
The Decompiler scans dense 6-note or 8-note chord clusters for internal triad formations. If it detects distinct triads separated by a perfect fifth, it **SHALL** abstract them into layered polyphonic voices rather than unreadable vertical stacks.

* **Machine:** `[a3 c#4 e4 e5 g#5 b5]:1`
* **Decompiled:** `<[ v1: [e5 g#5 b5]:1 | v2: [a3 c#4 e4]:1 ]>`

**12. Articulation Inference (Gate-Time Thresholds)**
MIDI represents staccato notes by halving the note duration and inserting a rest. The Decompiler evaluates the `gate_ticks` against the logical metric grid. If an event occupies exactly $\le 50\%$ of its allotted grid time, the engine restores the full logical duration and applies the semantic `.stacc` modifier.

* **Machine:** `c4:8 r:8 d:8 r:8`
* **Decompiled:** `c4:4.stacc d.stacc`

### D.2.4 Line & Graph Folding

**13. Glissando/Portamento Curve Fitting**
Dense MIDI pitch-bend streams are flattened into a continuous line graph. The Decompiler measures the starting pitch and the terminal target pitch, stripping the intermediate CC messages and replacing them with a single semantic spanner.

* **Machine:** `c4:64 c# d d# e f f# g`
* **Decompiled:** `c4:4.gliss g`

**14. Ornament Compression (Alternating Pitch Detection)**
If the Decompiler identifies a rapid, alternating sequence of major or minor second neighbor tones, it compresses the entire block into a single logical duration decorated with the `.tr` (trill) attribute.

* **Machine:** `c4:32 d c d c d c d c d c d`
* **Decompiled:** `c4:4.tr`

**15. Structural Loop Recognition (Graph Folding)**
The Decompiler generates a cryptographic hash for the absolute data of every measure block. When it detects a sequential array of identical measure hashes, it folds the timeline back into itself, wrapping the code in standard barline repeat tokens.

* **Machine:** `measure 1-8 { ... } measure 9-16 { [Exact copy of 1-8] }`
* **Decompiled:** `measure 1-8 { |: ... :| }`


# Addendum E: Target Bounds & Fallback Rendering (The Visual-Acoustic Demarcation)

**Version:** 1.0 (Extension to Tenuto 3.0.0)
**Status:** Normative / Final
**Scope:** AST Pruning, Graphic Notation Fallbacks, and Target-Specific Compilation Directives.

## E.1 Architectural Philosophy & The Demarcation Problem

Tenuto 3.0 unifies the discrete (sheet music) and the continuous (DSP/audio) into a single Abstract Syntax Tree (AST). However, when a compiler is executed with a discrete visual target (e.g., `tenutoc --target musicxml` or `--target svg`), it encounters **Unprintable Physics**—events and modifiers that possess absolute temporal geometry but zero diatonic visual spelling (e.g., a `.wav` file sliced via `style=concrete`, or an invisible `.cc` sidechain curve).

To guarantee deterministic behavior, a compliant Tenuto compiler **MUST** execute a rigid Demarcation Pass prior to Phase 5 (Visual Translation). The compiler must explicitly decide whether to **Prune** (silently ignore), **Draw** (use avant-garde graphic notation), or **Halt** (throw a fatal error).

## E.2 Staff-Level Resolution (The Style Filter)

The rendering fate of an entire staff is dictated by its `style` declaration in the `def` block.

### E.2.1 Native Visual Styles

Staves defined as `style=standard`, `style=tab`, or `style=grid` are inherently **Printable**. The compiler routes them directly to the Rebarring and Spelling engines.

### E.2.2 Unprintable Styles (`concrete`, `synth`, `chuck`)

Staves representing raw audio buffers or continuous frequency algorithms lack diatonic pitch data. By default, the compiler applies **Implicit Masking**:

* **Behavior:** When targeting XML/SVG, the compiler completely drops these staves from the global visual system, acting as if they were wrapped in an `if ($target == "audio")` directive.
* **Override:** A user **MAY** force the compiler to print these staves by explicitly setting `print=true` in the definition block (e.g., `def vox "Vocal" style=concrete print=true`). This triggers the **Graphic Notation Fallback** (See Section E.4).

## E.3 Attribute-Level AST Pruning

Even within a highly traditional, printable staff (`style=standard`), a user may attach modern DSP modifiers (e.g., `c4:4.pull(15ms).stretch`). The Demarcation Pass executes an $O(n)$ traversal of the AST, actively pruning audio-exclusive attributes from the visual layout tree while preserving the logical metrical anchors.

| Attribute Category | AST Action (Visual Target) | Visual Result (MusicXML/SVG) |
| --- | --- | --- |
| **Micro-Timing** (`.pull`, `.push`) | **Pruned** | Stripped entirely. The note renders perfectly quantized to its logical metrical grid fraction. |
| **Audio-Manipulation** (`.stretch`, `.slice`, `.reverse`) | **Pruned** | Stripped. The logical duration sets the visual bounding box. |
| **Physical ADSR Envelopes** (`env=@{...}`) | **Pruned** | Ignored by the layout engine. |
| **Continuous Control / LFOs** (`.cc`) | **Evaluated** | If attached to a Spacer token (`s:4.cc`), the node is skipped (no ink). If attached to a visible note, the base note prints, but the curve is ignored unless mapped to a standard text directive (e.g., "expr."). |
| **Monophonic Choke** (`cut_group`) | **Pruned** | Renders as standard, overlapping written durations; choke mechanics are purely acoustic. |

## E.4 Graphic Notation Fallback (The Aleatoric Renderer)

If a user explicitly forces a `style=concrete` or `style=synth` track to print via the `print=true` attribute, the compiler **MUST NOT** attempt to guess the diatonic pitch. Instead, it invokes the Graphic Notation Fallback, borrowing from 20th-century avant-garde typography.

1. **The One-Line Staff:** The standard 5-line staff is replaced with a single, unpitched horizontal timeline.
2. **Duration Blocks:** Events are drawn as thick, rectangular bounding boxes proportional to their exact logical duration.
3. **Label Injection:** The mapped alphanumeric token (e.g., the `A` in `vox: A:4`) is printed in a sans-serif font directly inside or above the bounding box to cue the performer/producer to the specific sample trigger.
4. **Curve Rendering (Continuous Pitch):** For `style=synth` executing `.glide(TimeVal)` or `.accelerate`, the compiler draws a continuous, interpolated Bezier curve corresponding to the frequency modulation, spanning across the visual measure space.

## E.5 Explicit Compilation Directives & Error Codes

To give the composer absolute control over the Demarcation Pass, Addendum E introduces specific compiler directives and a new 4000-Series error.

### E.5.1 The `@print` Directive

Users can manually override the AST Pruning engine on a per-node basis using the `@print` pseudo-attribute.

* *Syntax:* `s:4.cc(7, [0, 127], "linear").@print("Volume Swell")`
* *Execution:* The compiler prunes the raw MIDI CC data, but injects a standard `<direction><words>` text annotation reading *"Volume Swell"* into the MusicXML DOM at that exact absolute tick.

### E.5.2 E4006: Unprintable Physics



# Addendum F: The REPL Architecture & Sketch Mode (Tenuto-Light)

**Version:** 1.0 (Extension to Tenuto 3.0.0)  
**Status:** Normative / Final  
**Scope:** Auto-Scaffolding, Continuous State Persistence, and the REPL Execution Wrapper.

## F.1 Architectural Philosophy

The core Tenuto 3.0 specification mandates a strict "Declaration-Before-Use" hierarchy (`meta` -> `def` -> `measure`). While this guarantees absolute architectural safety for 100-page orchestral symphonies and complex AI generations, it introduces unnecessary friction for human composers wishing to quickly jot down a melody, or for users interacting with Tenuto via a web-based REPL.

**Addendum F** defines the **Sketch Mode Wrapper**. It explicitly forbids altering the deterministic LL(1) parser or the Intermediate Representation (IR) engine. Instead, it defines a normative pre-compilation layer that mathematically scaffolds raw musical events into a valid, compliant Tenuto AST behind the scenes, offering zero-friction input without compromising the compiler's mathematical truth.

## F.2 The Auto-Scaffolding Protocol

When the `tenutoc` compiler or `wasm32` runtime is invoked with the `--sketch` flag (or operating within a designated REPL environment), it **MUST** intercept the raw user input before lexical analysis and execute the Auto-Scaffolding Protocol.

### F.2.1 The Default Matrix
If a user inputs a raw event string (e.g., `c4:4 d e f.stacc g:2`), the wrapper **SHALL** inject it into the following hidden boilerplate:

```tenuto
tenuto "3.0" {
  meta @{ 
    title: "Tenuto Sketch", 
    tempo: 120, 
    time: "4/4",
    auto_pad_voices: true  %% Inherited from Addendum C
  }
  def sketch "Sketch" style=standard patch="gm_piano"
  measure 1 {
    sketch: [USER_INPUT] |
  }
}
```

### F.2.2 Implicit Instrument Routing
If the user wishes to sketch for multiple instruments simultaneously without writing definition blocks, the parser **SHOULD** map undefined identifiers to default fallback definitions dynamically.
*   *Input:* `vox: a4:4 | bass: a2:4`
*   *Scaffold Action:* The wrapper detects the undeclared `vox` and `bass` identifiers and automatically generates standard definitions (`def vox "vox" style=standard`, `def bass "bass" style=standard`) in the hidden header.

## F.3 Continuous State Persistence (The REPL Cursor)

In a traditional compiled environment, the `Cursor` memory is destroyed when the compiler process exits. In a REPL environment (like a web console or live-coding daemon), the state **MUST** be preserved across execution cycles to maintain Tenuto's token efficiency.

### F.3.1 Cross-Cycle Stickiness
If a user submits an execution block to the REPL:
`> c4:16 d e f`
The compiler evaluates the events and plays the audio. If the user subsequently submits a new block:
`> g a b c5`
The REPL instance **MUST** inject the saved `last_duration` (`:16`), `last_octave` (`4`), and `last_velocity` (`80`) from the previous execution cycle into the initialization state of the new AST cursor.

### F.3.2 Absolute Tick Accumulation
In Sketch Mode, the compiler **SHALL** treat sequential REPL inputs as additive to the continuous timeline. It bypasses the rigid `measure 1` index and instead anchors the new input to the maximum absolute `tick` generated by the previous execution cycle.

## F.4 Ejection (The Export Protocol)

The ultimate goal of a sketchpad is to eventually graduate the idea into a permanent, production-grade format. 

Compliant Sketch implementations **MUST** support the `eject` command (or API equivalent). 
*   **Behavior:** The compiler intercepts the active REPL memory, materializes the hidden Auto-Scaffolding wrapper, extracts the accumulated continuous timeline, and outputs a fully formed, valid `tenuto "3.0"` source file.
*   **Result:** A composer can doodle a 5-second jingle in a zero-friction web text box, click "Eject," and instantly download a heavily structured, archival-safe `.ten` file ready for orchestration, AI co-production, or MusicXML engraving.

## F.5 Implementation Guidelines for Web Environments

When implementing Addendum F within a WebAssembly (`wasm32`) context (such as the `<tenuto-score>` Custom Element acting as a live code editor):

1.  **Debounced Compilation:** The wrapper **SHOULD** debounce AST evaluation (typically `~200ms`) to prevent overwhelming the browser's Web Audio thread while the user is actively typing.
2.  **Non-Fatal Diagnostics:** In Sketch Mode, syntax errors **MUST NOT** trigger a fatal process exit. The wrapper must catch the `E1002` error, highlight the offending token in the UI via the Language Server Protocol (LSP), and maintain the last-known-good audio buffer for playback until the user corrects the text.

If the compiler is executed in `--strict` mode (which forbids Implicit Masking to ensure the user audits all output), and it encounters an unprintable staff without a `print=true` override, it throws a fatal error:

* **`E4006: Visual Translation Impossible.`**
* *Trigger:* Target is visual, `--strict` is enabled, and a `concrete` or `synth` staff is evaluated.
* *Resolution:* The user must explicitly wrap the track in `if ($target == "audio")`, or append `print=true` to force graphic notation.


# Addendum G: The Signal Routing & Spatial Audio Matrix (The Post-Production Engine)

**Version:** 1.0 (Extension to Tenuto 3.0.1)  
**Status:** Normative / Final  
**Scope:** Internal Bus Routing, Spatial Primitives, Abstract DSP Effects, and Layered Execution.

## G.1 Architectural Philosophy

Historically, the act of *composing* music (writing notes) and the act of *mixing* music (panning, reverb, live audio buffering) have existed in two separate ontological domains. Mixing data is almost exclusively trapped in proprietary, closed-ecosystem Digital Audio Workstation (DAW) files, making it highly susceptible to "bit rot" when third-party VST plugins deprecate.

**Addendum G** collapses the mixing console into the Tenuto 3.0 Abstract Syntax Tree (AST). By strictly adhering to the **"Narrow Waist" Layered Architecture**, Tenuto serializes post-production intent as abstract mathematical data in the Intermediate Representation (IR). It stores the *concept* of an acoustic space, guaranteeing that a cinematic, heavily-processed track will render perfectly a century from now, regardless of the underlying physical audio hardware.

---

## G.2 The Internal Bus Protocol (`bus://`)

The Schaefferian Engine (`style=concrete`) is expanded to support internal, real-time live audio buffering alongside external static files.

### G.2.1 Syntax and Routing
A compiler **MUST** accept the `bus://` URI schema within a `concrete` definition block. 
*   `src="bus://master"`: Captures the entire global mix output.
*   `src="bus://[staff_id]"`: Captures the isolated post-fader audio output of a specific track (e.g., `bus://pno`).

**Example:**
```tenuto
def live_chop "Glitch Bus" style=concrete src="bus://pno" map=@{ buffer: [0s, 2s] }
```

### G.2.2 The "No Circular Dependency" Guarantee
In traditional compilers, loopbacks create fatal infinite loops. Tenuto avoids this by leveraging its **Layered IR**. 
1. The Tenuto IR mathematically evaluates the timeline and sets an abstract marker: *"At tick 15360, trigger `live_chop`, slice its buffer into 8 pieces, and reverse them."*
2. The compiler **SHALL NOT** attempt to render this audio internally. 
3. It passes the timeline to the Transport Layer (OSC / Wasm). The Physical Audio Backend (SuperCollider / Web Audio API) dynamically handles the live RAM buffering and execution during actual playback.

---

## G.3 Spatial Audio Primitives

Tenuto transcends the archaic limitations of MIDI `CC 10` (Pan) by introducing native, high-resolution Spatial Audio modifiers. These evaluate to mathematically exact trajectories across the absolute timeline.

### G.3.1 Stereo Vector Panning (`.pan`)
**Syntax:** `.pan([Start, End], "Curve")`
*   Values range from `-1.0` (Hard Left) to `1.0` (Hard Right).
*   **Execution:** `c4:1.pan([-1.0, 1.0], "linear")` instructs the execution environment to smoothly sweep the audio from the left speaker to the right speaker over exactly one whole note.

### G.3.2 3D Ambisonic Orbiting (`.orbit`)
For Dolby Atmos, VR spatial audio, and ambisonic arrays, Tenuto introduces a 3D coordinate abstraction.
**Syntax:** `.orbit(Radius, Velocity_Hz)`
*   **Execution:** `s:4.orbit(5.0, 0.5)` draws an invisible control lane instructing the physical backend to rotate the audio source around the listener at a distance of 5 meters, completing half a revolution per second ($0.5$ Hz), lasting for one quarter note.

---

## G.4 Abstract DSP Effect Chains (`.fx`)

To ensure absolute archival safety, Tenuto **FORBIDS** the hardcoding of proprietary plugin names (e.g., *FabFilter Pro-Q*). Instead, the language standardizes an abstract dictionary of universal acoustic phenomenon.

### G.4.1 The Standard FX Lexicon
Compliant compilers **MUST** support the following abstract FX targets: `reverb`, `delay`, `distort`, `chorus`, `filter_lp`, `filter_hp`.

### G.4.2 Syntax and Map Arguments
Effects are chained to events or invisible Spacers (`s`) using the Map Sigil `@{}`.
**Syntax:** `Event.fx(Type, @{ parameters })`
```tenuto
%% Applies a massive 90% wet 4-second reverb to a single piano chord
[c3 g3 c4]:1.fx(reverb, @{ mix: 0.90, decay: 4s })
```

---

## G.5 Execution and Demarcation (The Layered Hand-off)

Addendum G heavily populates the IR with unprintable physics. The Tenuto runtime **MUST** enforce the **Visual-Acoustic Demarcation Pass** before emission.

1. **The Visual Output (MusicXML/TEAS):** The engraving engine actively hunts for `.pan`, `.orbit`, and `.fx`. It aggressively **PRUNES** these attributes from the AST. A note with a complex 3D orbit and delay line will print on the sheet music as a perfectly standard, clean quarter note.
2. **The Web Audio Output (Wasm):** The web runtime translates `.fx(reverb)` into a native `ConvolverNode`, `.pan` into a `StereoPannerNode`, and `bus://` into a live `MediaStreamAudioDestinationNode`.
3. **The Pro Audio Output (TEDP/OSC):** The daemon packages the exact float trajectories of the effects into `/tenuto/fx` and `/tenuto/spatial` OSC bundles, transmitting them ahead of the execution horizon to SuperCollider or Ableton Live.

---

## G.6 Reference Implementation: The Avant-Garde Coda

This example demonstrates the extreme power of Addendum G. We take the final chord of a traditional orchestral piece and, entirely through text, route it into a live RAM buffer, shatter it into 16th notes, hard-pan the fragments, and wash the master bus in infinite reverb.

```tenuto
tenuto "3.0" {
  meta @{ title: "Rhapsody - The Shattered Coda", tempo: 60, time: "4/4" }

  %% 1. Standard Acoustic Physics
  def pno "Piano" style=standard patch="gm_piano"
  def sub "Deep Sine" style=synth cut_group=1

  %% 2. Addendum G: The Post-Production Engines
  %% We set up a concrete sampler that listens LIVE to the Piano track!
  def glitch "Resampler" style=concrete src="bus://pno" map=@{ capture: [0s, 4s] }
  
  %% We set up a master bus purely to automate the global reverb tail.
  def master "Master FX" style=concrete src="bus://master"

  measure 80 {
    pno: <[
      v1:[eb1 bb1 eb2 g2 bb2 eb3]:1.ffff.letring |
      v2: s:1.ped | 
    ]>

    sub: 
      %% Plunges the sub-bass into sub-sonic frequencies over 4 beats
      eb1:1.glide(4s) eb0:1 |

    glitch: 
      %% Mathematically chops the live piano resonance into 16 fragments,
      %% reverses every other slice, and sweeps them violently from Left to Right.
      capture:1.slice(16).reverse.pan([-1.0, 1.0], "linear") |

    master:
      %% Action Notation: An invisible spacer applies an expanding 
      %% reverb to the entire system, fading into the void.
      s:1.fx(reverb, @{ mix: [0.0, 1.0], decay: 8s }) |
  }
}
```
