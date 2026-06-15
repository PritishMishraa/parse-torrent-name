# parse-torrent-name Modernization Roadmap

This document consolidates product direction, parser architecture, implementation
stages, testing strategy, API decisions, and publishing checks for modernizing
`parse-torrent-name`.

It is intentionally detailed. A contributor should be able to read this file and
understand what needs to be built, why it matters, and how to approach the work
without needing the original Codex threads.

## Current Execution Plan

Work should proceed in thin compatibility-preserving slices:

1. Preserve the current public behavior with the existing test and benchmark
   suite.
2. Add internal tokenizer and span utilities with independent tests, without
   changing public parser output.
3. Add candidate extractor scaffolding for a small set of high-confidence
   fields while keeping the old parser as the projection path.
4. Add conflict resolution tests for known ambiguous overlaps.
5. Replace title, episode name, group, and excess inference one area at a time
   using accepted candidate spans.
6. Add `includeDebug` only after candidates and conflict resolution are stable.
7. Add TypeScript declarations or migrate internals once the runtime contracts
   have stopped moving.

Current progress:

- Stage 0 baseline is in place: public tests, normalized-output tests, and a
  benchmark command exist.
- Stage 1 is complete with internal tokenizer/span utilities and focused tests.
- Stage 2 is complete with internal candidate extractor scaffolding, rule IDs,
  priorities, and focused tests for high-confidence metadata fields.
- Stage 3 is complete with candidate-producing rules for high-confidence
  structural, technical, descriptive, language, container, group, encoder, and
  prefix fields while preserving the legacy parser as the public projection
  path.
- Stage 4/5 internal infrastructure is in place with deterministic candidate
  conflict resolution, accepted/rejected overlap tracking, consumed span maps,
  unconsumed span maps, and focused tests for ambiguous overlap behavior.
- Stage 6 has started: public title inference now uses accepted candidate spans
  from a focused title-boundary extractor, with legacy-compatible cleanup,
  fallback behavior, and focused inference tests.
- Stage 7 has started: public episode name inference now uses accepted
  candidate spans from a focused episode-name boundary extractor, with
  release-metadata boundary handling and focused negative tests for language
  metadata.
- Stage 8 has started: public final-hyphen group inference now uses accepted
  candidate spans, and conservative `-Encoder-GROUP` releases emit `encoder`
  while preserving fallback group behavior for legacy non-hyphen cases.

## Source Context

Notes were consolidated from these Codex threads:

- `019ec58a-1e2d-7a83-876b-fb812935b447`
- `019ec599-c5de-7e10-8c19-fc5d9384aebd`

The threads discussed how `parse-torrent-name` could be rewritten for current
times, and what ideas are worth borrowing from:

- `parse-torrent-title`: https://github.com/clement-escolano/parse-torrent-title
- `rank-torrent-name`: https://pypi.org/project/rank-torrent-name/

Both referenced projects were checked as MIT-licensed in the thread. Borrowing
ideas is fine. Copying code or fixtures should preserve attribution and license
notices.

## Product Direction

Keep `parse-torrent-name` as a small deterministic parser.

The core package should answer one question:

> What metadata is present in this release name?

The core package should not answer these questions:

- Is this release good for my application?
- Should this torrent be downloaded?
- Which tracker/search result should win?
- What is the real movie/show metadata from an external database?
- What does the media file contain according to `ffprobe`?

Those are useful problems, but they belong in optional utilities or companion
packages, not in the parser core.

### Boundaries

The parser core must remain:

- deterministic
- network-free
- fast
- dependency-light
- usable as a small library dependency
- safe to call thousands of times
- independent of download/search/scraper workflows

Do not turn the core package into:

- a downloader
- a scraper
- a metadata fetcher
- a torrent client abstraction
- a ranking policy engine
- an LLM-based parser
- an `ffprobe` wrapper

## Long-Term Package Shape

The strongest long-term shape is layered:

```txt
parse-torrent-name
|- core parser
|  `- parse(name) -> parsed metadata
|- rule system
|  `- Parser, addRule, rule packs
`- optional utilities
   |- normalizeTitle()
   |- titleSimilarity()
   |- scoreTorrent()
   |- filterTorrent()
   |- sortTorrents()
   `- isAcceptable()
```

Default usage should stay simple:

```js
parseTorrentName("Movie.2024.2160p.AMZN.WEB-DL.DDP5.1.Atmos.DV.HDR10.HEVC-GRP")
```

Advanced users should be able to customize parsing without forking:

```js
const parser = new Parser()

parser.use(defaultRules)
parser.addRule("part", /Part[. ]([0-9])/i, { type: "integer" })

parser.parse(name)
```

The default API should remain boring and predictable. Extensibility should exist,
but it should not make the common path harder.

## Core Architectural Decision

The rewrite should not be framed as "regex parser vs modern parser".

Torrent names are not a clean formal language. They are noisy, semi-structured
release strings. A full grammar generator can make some parts look cleaner, but
it can also force ambiguous real-world input into a fake grammar.

The better architecture is:

```txt
input string
-> preprocess
-> tokenize while preserving spans
-> recognize candidate metadata spans
-> resolve conflicts
-> infer title, episodeName, group, excess
-> project to the public result shape
-> optionally normalize
```

Regex is still acceptable inside small recognizers. The goal is not "no regex".
The goal is to stop letting regex matches directly mutate parser state and final
output.

### Current Problem To Fix

The current parser style is fragile because extraction and mutation are coupled.
Rules match text, immediately assign fields, and remove raw substrings from a
working string used later for `title`, `episodeName`, `group`, and `excess`.

That creates hidden dependencies:

- changing one rule can change later title inference
- rule order becomes implicit conflict resolution
- overlapping matches are hard to reason about
- `excess` depends on destructive string replacement
- debugging requires mentally replaying the whole parser

The rewrite should make parser decisions explicit.

## Recommended Modern Parser Pipeline

### Stage 1: Preprocess

Purpose:

Normalize input just enough to make parsing predictable, without destroying
information needed for raw output.

What to do:

- accept only strings as public input, or coerce intentionally and document it
- trim obvious surrounding whitespace
- preserve the original input as `raw`
- normalize Unicode only in helper fields, not by mutating the raw input
- identify bracketed sections, separators, and extension-like suffixes

What not to do:

- do not lowercase the entire input before parsing
- do not replace all separators with spaces globally
- do not remove substrings before span tracking exists
- do not normalize away information that should be returned later

### Stage 2: Tokenize With Spans

Purpose:

Split the input into useful lexical units while preserving enough position and
separator information to reconstruct decisions.

Suggested token model:

```ts
type Token = {
  raw: string
  normalized: string
  start: number
  end: number
  separatorBefore?: string
  separatorAfter?: string
  bracket?: "round" | "square" | "curly"
}
```

Important detail:

Do not lose separators completely. Dots, spaces, hyphens, brackets, underscores,
and slashes can carry meaning in torrent names.

Examples:

- `Movie.Name.2024.1080p.WEB-DL-GRP`
- `Movie Name (2024) 1080p WEB-DL - GRP`
- `[Site] Movie.Name.S01E02.720p.HDTV.x264-GRP`
- `Game of Thrones - 4x03 - Breaker of Chains`

These have similar metadata but different structural hints. The tokenizer should
make those hints available to later stages.

### Stage 3: Extract Candidate Metadata

Purpose:

Rules should produce candidate matches. They should not directly mutate final
parser output.

Suggested candidate model:

```ts
type Candidate = {
  field: string
  raw: string
  value: unknown
  start: number
  end: number
  priority: number
  confidence: number
  source: string
  consumes: boolean
}
```

Notes:

- `field` is the public or internal field being proposed.
- `raw` is the original substring.
- `value` is the cleaned parsed value.
- `start` and `end` are character offsets in the original input.
- `priority` handles intentional ordering between classes of rules.
- `confidence` helps choose between plausible interpretations.
- `source` identifies the rule/extractor that produced the candidate.
- `consumes` decides whether the span should be removed from title/excess
  inference.

Examples of candidate-producing extractors:

- season/episode extractor
- year extractor
- resolution extractor
- source extractor
- codec extractor
- audio extractor
- channels extractor
- HDR/color extractor
- service extractor
- language extractor
- release flag extractor
- group extractor
- encoder extractor
- website/prefix extractor

### Stage 4: Resolve Conflicts

Purpose:

Make ambiguity explicit and predictable.

Overlapping candidates should be resolved by documented rules instead of hidden
side effects.

Suggested conflict rules:

- higher priority beats lower priority
- longer/specific matches beat shorter/partial matches
- structural matches beat loose keyword matches
- `S01E02`, `1x02`, and `Season 1 Episode 2` beat loose numeric guesses
- a year inside a season/episode token should not become a release year
- `WEB-DL` should beat a weaker `WEB` or `DL` match
- `DTS-HD MA` should beat a weaker `DTS` match
- `HDR10+` should beat `HDR10`, which should beat generic `HDR`
- final `-GROUP` patterns should be handled separately from ordinary metadata
- bracketed website prefixes should not become titles or release groups

Conflict resolution should return both:

- accepted candidates
- rejected candidates when debug output is requested

This makes parser behavior easier to explain.

### Stage 5: Mark Consumed Spans

Purpose:

Track which parts of the original string were confidently identified as metadata.

Do this:

- mark accepted candidates with `consumes: true`
- keep a span map of consumed and unconsumed character ranges
- preserve enough raw text to report debug information

Do not do this:

- do not repeatedly call `string.replace()`
- do not infer title from "whatever text survived mutation"
- do not let a later rule depend on a previous rule deleting text

Span tracking is the core improvement. It makes title, group, episode name, and
excess inference much less brittle.

### Stage 6: Infer Title

Purpose:

Derive the human title from leading unconsumed spans, not from the earliest match
index alone.

Guidelines:

- title usually appears before high-confidence release metadata
- leading website/prefix spans should not be part of title
- bracketed year should usually end the title region
- show episode markers usually end the title region
- title cleanup should preserve meaningful punctuation where possible
- title cleanup should convert common separators to spaces
- title inference should be allowed to use structural context, not only regex

Avoid copying the "title ends at earliest matched index" approach as-is. It is
simple, but brittle.

### Stage 7: Infer Episode Name

Purpose:

Derive an episode name when show metadata is present and a remaining phrase sits
between episode marker and release metadata.

Examples:

- `Marvels.Agents.S02E01.Shadows.1080p.WEB-DL`
- `Gotham.S01E07.Penguins.Umbrella.WEB-DL.x264.AAC`
- `Game of Thrones - 4x03 - Breaker of Chains`

Guidelines:

- only infer `episodeName` when season/episode context is present
- prefer spans after episode marker and before release metadata
- avoid treating release group, source, codec, or audio as episode name
- preserve human-readable casing and spacing from raw input where reasonable

### Stage 8: Infer Group And Encoder

Purpose:

Separate final release group from encoder when there is enough confidence.

`group` should remain backward compatible. `encoder` can be added as an
additional field when the parser has a strong signal.

Guidelines:

- final `-GROUP` is usually release group
- bracketed suffixes can be group-like in older release names
- an encoder can appear before the final group in some names
- do not guess `encoder` from arbitrary title-looking text
- keep `group` stable for compatibility

Example goal:

```js
{
  group: "NTb",
  encoder: "SomeEncoder"
}
```

Only emit `encoder` when confidence is high.

### Stage 9: Infer Excess

Purpose:

Report meaningful leftover tokens without using destructive string replacement.

Guidelines:

- `excess` should be derived from unconsumed spans after title/group/episodeName
  inference
- ignore pure separators
- preserve unknown meaningful tokens
- return a string for one leftover item and an array for multiple items only if
  preserving existing API behavior requires that shape
- consider whether future major versions should always return arrays for
  multi-value fields

### Stage 10: Project To Public Result

Purpose:

Convert resolved candidates and inferred fields into the plain object returned by
`parseTorrentName(name)`.

Default output should preserve original-ish parsed values:

```js
{
  title: "Movie Name",
  year: 2024,
  resolution: "2160p",
  source: "web-dl",
  codec: "HEVC",
  audio: "DDP",
  colors: ["HDR10", "DV"],
  group: "NTb"
}
```

The public result should not expose internal candidate structures unless a debug
option is enabled.

### Stage 11: Optional Normalization

Purpose:

Provide stable normalized values for filtering, ranking, search, and
deduplication without throwing away raw parsed values.

Normalization should be opt-in:

```js
parseTorrentName(name, { normalize: true })
```

The top-level fields should preserve parsed release text where possible. A
separate `normalized` object should contain normalized values:

```js
{
  title: "Movie Name",
  source: "WEB-DL",
  normalized: {
    title: "movie name",
    source: "webdl",
    releaseType: "web"
  }
}
```

Do not return normalized values by default unless a future major version makes
that breaking change intentionally.

## Rule System

### Rule Contract

Rules should be small candidate extractors with a predictable contract.

Suggested shape:

```ts
type Rule = {
  id: string
  field: string
  priority: number
  match(ctx: ParseContext): Candidate[]
}
```

Suggested parse context:

```ts
type ParseContext = {
  input: string
  tokens: Token[]
  options: ParseOptions
}
```

Rules may use regex internally. That is fine. The important constraint is that a
rule returns candidates instead of mutating parser state.

### Rule Packs

Rules should be grouped by domain:

- episode rules
- year rules
- resolution rules
- source rules
- service rules
- codec rules
- audio rules
- HDR/color rules
- language rules
- flag rules
- group/encoder rules
- website/prefix rules
- container rules
- garbage/excess rules

This helps users add or replace one area of behavior without understanding the
entire parser.

### Data-Driven Aliases

Aliases should be data-driven where possible, especially for:

- streaming services
- codecs
- audio formats
- languages
- source names
- release flags
- containers

Example:

```ts
const services = {
  AMZN: ["AMZN", "Amazon"],
  ATVP: ["ATVP", "AppleTV"],
  DSNP: ["DSNP", "Disney+"]
}
```

Data-driven aliases make coverage easier to audit and extend.

## API Shape

### Preserve The Simple Default API

```js
parseTorrentName(name)
```

The default return value should remain a plain object.

### Add Advanced Parse Options

Suggested options:

```ts
parseTorrentName(name, {
  normalize: true,
  includeRaw: false,
  includeDebug: false
})
```

Possible meanings:

- `normalize`: include a `normalized` object
- `includeRaw`: include raw input and raw spans for selected fields
- `includeDebug`: include candidates, rejected candidates, and resolution trace

Debug output should be treated as less stable than the public parsed result.

### Add Parser Instance API

Suggested usage:

```ts
const parser = new Parser()

parser.use(defaultRules)
parser.addRule(customRule)
parser.parse(name)
```

This enables custom parsing without forking.

Important decisions:

- define whether rules are appended or inserted by priority
- define whether custom rules can override default rules
- define whether parser instances are immutable after construction
- define whether `parseTorrentName()` uses a shared default parser internally

For a small library, prefer simple behavior first:

- default parser is preconfigured
- custom `Parser` instances are opt-in
- rules are ordered by priority and then insertion order

## Result Model

Define an explicit result type.

Suggested public type:

```ts
type ParsedTorrentName = {
  raw?: string
  title?: string
  normalizedTitle?: string
  season?: number
  episode?: number | number[]
  episodeName?: string
  year?: number
  resolution?: string
  source?: string
  quality?: string
  codec?: string
  audio?: string
  audios?: string[]
  channels?: string
  color?: string
  colors?: string[]
  service?: string
  services?: string[]
  language?: string
  languages?: string[]
  group?: string
  encoder?: string
  container?: string
  flags?: string[]
  excess?: string | string[]
  normalized?: NormalizedTorrentName
}
```

Avoid over-normalizing everything into strict enums. Torrent naming changes
constantly, and users often need the original-ish parsed value.

### Multi-Value Fields

Torrent names can contain multiple signals for audio, language, color/HDR,
source, and service.

Prefer stable plural fields:

```js
{
  audio: "DDP",
  audios: ["DDP", "Atmos"],
  color: "HDR10",
  colors: ["HDR10", "DV"],
  language: "en",
  languages: ["en", "fr"]
}
```

Keep backward-compatible scalar fields while adding arrays for richer consumers.

Avoid awkward generated names like `audiolist`.

## TypeScript And Package Format

Recommended modern stack:

- TypeScript source
- ESM-first package
- CJS compatibility build only if consumer compatibility requires it
- Node 24 LTS as a modern baseline, or Node 22 as a wider compatibility floor
- `node:test` plus `node:assert/strict` for a small dependency-light package
- Vitest only if richer test DX is worth the dependency
- `tsup`, `rolldown`, or `unbuild` only if dual ESM/CJS output is needed
- ESLint plus Prettier, or Biome as a single lint/format tool
- fixture-based tests in JSON/YAML or categorized JS fixtures
- property/fuzz tests with something like `fast-check`
- benchmarks, because this parser should remain cheap to call thousands of times

### Public Entry Points

Treat `package.json#exports` as the source of truth for public entry points.

This means:

- every documented import path must be present in `exports`
- every exported path should have the correct runtime file
- every exported path should have matching type declarations
- tests should import through public entry points where practical
- undocumented internal files should not accidentally become public API

Example:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./normalize": {
      "types": "./dist/normalize.d.ts",
      "import": "./dist/normalize.js",
      "require": "./dist/normalize.cjs"
    }
  }
}
```

If the package remains CJS-only in the short term, still keep `exports` accurate
and intentional.

### Publish Validation

Before publishing, validate package output with:

- `publint`
- `@arethetypeswrong/cli` / ATTW
- `npm pack --dry-run`
- tests against the packed tarball when possible

Suggested scripts:

```json
{
  "scripts": {
    "test": "node --test",
    "build": "tsc -p tsconfig.json",
    "lint:package": "publint && attw --pack",
    "prepublishOnly": "npm test && npm run build && npm run lint:package"
  }
}
```

Exact commands may vary by package format. The important rule is that package
exports and types must be verified before publish, not debugged after users
install the package.

## Testing Strategy

Use three levels of tests.

### 1. Golden Result Fixtures

Purpose:

Protect public behavior.

Shape:

```json
{
  "name": "Movie.Name.2024.2160p.WEB-DL.DDP5.1.HEVC-GRP",
  "expected": {
    "title": "Movie Name",
    "year": 2024,
    "resolution": "2160p",
    "source": "web-dl",
    "audio": "DDP",
    "codec": "HEVC",
    "group": "GRP"
  }
}
```

Golden fixtures should be grouped by domain:

- `resolution`
- `source`
- `codec`
- `audio`
- `language`
- `group`
- `encoder`
- `title`
- `episode`
- `episodeName`
- `criterion`
- `downscaled`
- `convert`
- `flags`
- `anime`
- `services`
- `hdr`
- `containers`
- `edge-cases`

This is one of the highest-ROI changes because it makes regressions easier to
isolate.

### 2. Stage Tests

Purpose:

Make the internal parser easier to refactor.

Test each stage separately:

- tokenizer output
- candidate extraction
- conflict resolution
- consumed span map
- title inference
- episode name inference
- group/encoder inference
- final projection
- normalization

Stage tests should focus on difficult ambiguity.

Examples:

- `S2024E01` should not produce `year: 2024`
- `HDR10+` should not become only `HDR10`
- `DTS-HD MA` should not become only `DTS`
- `[Site]` should not become title
- final `-GROUP` should not become episode name

### 3. Robustness And Fuzz Tests

Purpose:

Ensure odd real-world input does not throw or produce structurally invalid
results.

Test:

- empty strings
- whitespace-only strings
- repeated separators
- unmatched brackets
- Unicode titles
- extremely long names
- repeated metadata
- malformed season/episode markers
- mixed dots, spaces, underscores, and hyphens

Property tests with `fast-check` can help ensure malformed names do not throw.

### Regression Rule

Every bug fix should add a fixture that describes the ambiguity it protects.

Bad:

```txt
fix parsing
```

Good:

```txt
year extractor must ignore years inside S2024E01-style episode markers
```

## Benchmarking

Keep benchmarks because this parser should be cheap to call many times.

Benchmark at least:

- simple movie name
- movie with full modern metadata
- show episode
- show episode with episode name
- noisy release with website prefix
- release with multiple audio/HDR/language signals

Benchmark goals:

- compare against current implementation before major rewrite
- prevent large accidental regressions
- keep dependency choices honest

Do not optimize prematurely, but do measure.

## Coverage To Add Or Improve

### Modern Release Features

Add or improve support for:

- `DS4K`
- `downscaled`
- `CONVERT`
- `Criterion`
- `Extras`
- `3D`
- `upscaled`
- `commentary`
- `documentary`
- `subbed`
- `dubbed`
- `edition`
- `IMAX`
- `IMAX Enhanced`
- `REMUX`
- `Hybrid`
- `MULTi`
- anime-style release names
- scene-group naming patterns

### Sources

Worth adding:

- `WEBMux`
- `BDMux`
- `BRMux`
- `DLMux`
- `TVRip`
- `PPVRip`
- `R5`
- `VHSSCR`
- `BDRip`
- `HDDVD`
- `NTSC`
- `PAL`

### Services

Worth adding:

- `ROKU`
- `STAN`
- `iT` / `iTunes`
- `AUBC`
- `BNGE`
- `SKST`
- `ANPL`

### Audio

Improve support for:

- `DTS-HD MA`
- `DD-EX`
- `EAC3`
- `TrueHD`
- `FLAC`
- `Atmos`
- `DDP5.1`
- `Opus`
- `AAC2.0`
- channel variants such as `2.0`, `5.1`, `7.1`, `6ch`, `8ch`

## Ideas To Borrow From `parse-torrent-title`

Borrow:

- parser instance API
- user-defined rules
- category-based fixtures
- richer modern release coverage
- encoder vs release group distinction
- multi-value fields
- richer source/service/audio coverage

Improve:

- clearer TypeScript types
- rule priorities
- span-aware extraction
- predictable conflict resolution
- debug traces

Do not copy:

- brittle "title ends at earliest matched index" behavior
- code or fixtures without preserving license/attribution

## Ideas To Borrow From `rank-torrent-name`

`rank-torrent-name` is more of a parse-plus-decision engine than a parser.
Borrow useful consumer-facing ideas, but keep them out of the core parse call.

### Normalized Title Helper

Expose title normalization:

```js
normalizeTitle("Amelie & Co.") // "amelie and co"
```

This helps matching, deduping, search result comparison, and ranking.

### Title Similarity Utility

Add a helper:

```js
titleSimilarity("Spider-Man", "Spider Man")
```

This helps reject bad search results. Keep it simple at first. Avoid native
dependencies unless clearly justified.

### Optional Scoring And Ranking

Add ranking as a separate export, not inside `parseTorrentName()`:

```js
scoreTorrent(parsed, profile)
filterTorrent(parsed, rules)
sortTorrents(torrents, profile)
```

Useful scoring dimensions:

- resolution
- source
- codec
- audio
- HDR/DV/color
- release flags
- trash-quality flags
- preferred services

### Require / Exclude / Prefer Policies

Borrow the policy idea:

```js
const profile = {
  require: [/1080p|2160p/i],
  exclude: [/CAM|TS|R5/i],
  prefer: [/HDR|DV|BluRay/i]
}
```

Make this an optional selection module, not parser logic.

### Explainable Eligibility

Provide an accept/reject helper with reasons:

```js
isAcceptable(parts, policy)
// { ok: false, reasons: ["resolution_unknown", "trash_quality"] }
```

This is better than a raw score for scraper/search workflows because users need
to understand why a result was rejected.

### Resolution Buckets

Expose sortable resolution weights:

```txt
2160p > 1440p > 1080p > 720p > 480p > unknown
```

This is useful for ranking without baking one person's whole scoring policy into
the parser.

### Optional File Metadata

`rank-torrent-name` has file metadata ideas via `ffprobe`. This can be useful,
but keep it separate from the core parser because it changes dependencies and
runtime behavior.

Possible shape:

```txt
parse-torrent-name/file-metadata
```

or a separate companion package.

## What Not To Copy From `rank-torrent-name`

Do not import its full ranking model directly.

Avoid putting these into the parser core:

- hardcoded app-specific scores like `remux = 10000`
- seeders
- trackers
- infohashes
- fetch decisions
- torrent object models
- downloader/search workflow assumptions
- required `ffprobe`

Those are application policy, not parser responsibilities.

## Implementation Stages

### Stage 0: Preserve Current Behavior

Goal:

Make sure the existing package behavior is captured before rewriting internals.

Tasks:

- keep current public tests passing
- convert current test cases into organized fixtures
- add tests for current normalized output
- add benchmark baseline
- document current known quirks

Why:

A rewrite without a behavior baseline will accidentally break consumers.

Done when:

- current fixture corpus passes
- benchmark command exists
- current API behavior is documented enough to compare

### Stage 1: Introduce Tokenizer And Span Utilities

Goal:

Create the foundation for span-aware parsing without changing public output.

Tasks:

- implement token model
- implement separator/bracket-aware tokenizer
- implement span utility helpers
- add tokenizer tests
- keep tokenizer internal

Why:

Every later parser improvement depends on reliable spans.

Done when:

- tokenizer stage is tested independently
- current public parser output is unchanged

### Stage 2: Introduce Candidate Extractors

Goal:

Move from direct field assignment to candidate production.

Tasks:

- define `Candidate`
- implement extractors for high-confidence fields first
- include rule IDs and priorities
- add candidate extraction tests
- initially keep public output compatible

Suggested first extractors:

- season/episode
- year
- resolution
- source
- codec
- audio
- HDR/color
- service
- flags
- group

Why:

Candidate extraction makes conflicts observable instead of hidden in rule order.

Done when:

- major current fields can be produced as candidates
- candidate tests cover overlaps and ambiguous values

Status:

- Complete. The internal `candidate-extractors` module defines candidate and
  parse context creation, includes rule IDs and priorities, and extracts
  high-confidence structural and technical metadata while preserving current
  public parser behavior.

### Stage 3: Add Conflict Resolver

Goal:

Make parser decisions explicit.

Tasks:

- implement priority/specificity resolution
- reject overlapping lower-confidence candidates
- preserve rejected candidates for debug mode
- add tests for ambiguous matches

Why:

This replaces hidden rule-order behavior with documented parser policy.

Done when:

- conflict resolution is tested independently
- accepted candidates match current expected output for existing fixtures

### Stage 4: Replace Destructive Title/Excess Logic

Goal:

Infer `title`, `episodeName`, `group`, and `excess` from accepted candidates and
unconsumed spans.

Tasks:

- implement consumed span map
- infer title from leading unconsumed spans
- infer episode name from show-specific remaining spans
- infer group from suffix structure
- infer excess from remaining meaningful spans
- add regression tests for current tricky cases

Why:

This removes the most brittle part of the current parser architecture.

Done when:

- public fixtures pass
- no parser stage depends on destructive `string.replace()` cleanup

### Stage 5: Add Debug Output

Goal:

Make parser behavior explainable for maintainers and advanced users.

Tasks:

- add `includeDebug` option
- expose tokens, accepted candidates, rejected candidates, and resolution trace
- document debug output as non-stable/internal-ish
- add snapshot-like tests only where useful

Why:

Debug output makes future rule additions safer.

Done when:

- a failing parse can be inspected without stepping through the whole parser

### Stage 6: Add TypeScript Types

Goal:

Make parser contracts explicit.

Tasks:

- migrate source to TypeScript or add generated declarations if staying JS
- define public result types
- define internal token/candidate/rule types
- ensure emitted declarations match public exports
- verify with ATTW before publish

Why:

Types are especially valuable once parser internals become extensible.

Done when:

- package consumers get useful types from public entry points
- `@arethetypeswrong/cli` passes

### Stage 7: Add Parser Instance API

Goal:

Allow custom parsing without forking the package.

Tasks:

- implement `Parser`
- implement `use(rulePack)`
- implement `addRule(rule)`
- define rule priority behavior
- make default export use a default parser
- add tests for custom rules

Why:

Extensibility is one of the main reasons to move beyond the current flat parser.

Done when:

- users can add one rule without changing package source
- default API remains simple

### Stage 8: Expand Metadata Coverage

Goal:

Improve modern torrent/release coverage after the core architecture is stable.

Tasks:

- add richer source/service/audio/language aliases
- add flags such as `DS4K`, `CONVERT`, `Criterion`, `IMAX`, `Extras`
- add anime and scene naming fixtures
- add encoder vs group support
- add plural fields where useful

Why:

Coverage expansion is much safer after candidate extraction and conflict
resolution exist.

Done when:

- new fixtures are categorized
- old fixtures still pass
- benchmark remains acceptable

### Stage 9: Add Optional Utilities

Goal:

Provide useful consumer helpers without polluting the parser core.

Tasks:

- export `normalizeTitle()`
- export `titleSimilarity()`
- optionally export `scoreTorrent()`
- optionally export `filterTorrent()`
- optionally export `sortTorrents()`
- optionally export `isAcceptable()`

Why:

Many users parse torrent names to compare and select releases, but that policy
should stay outside `parseTorrentName()`.

Done when:

- utilities are separate public entry points
- `package.json#exports` documents them intentionally
- utilities do not add heavy dependencies to the core parser path

### Stage 10: Package And Publish Hardening

Goal:

Ensure users receive the intended runtime files, types, and public entry points.

Tasks:

- treat `package.json#exports` as source of truth
- run `publint`
- run `@arethetypeswrong/cli` / ATTW
- run `npm pack --dry-run`
- test imports from the packed package
- verify ESM/CJS behavior if both are published
- verify README examples against public entry points

Why:

Modern Node package publishing often fails at the packaging boundary, not in the
source code. Validate the package exactly as consumers will install it.

Done when:

- publish checks pass locally and in CI
- all documented imports work from the packed tarball

## Backward Compatibility Strategy

The existing `parseTorrentName(name)` API should remain stable.

A rewrite should first reproduce the current test corpus before changing public
behavior. New fields should generally be additive. Breaking changes should be
grouped into a major version.

Recommended migration path:

1. Add span-aware internals behind the existing API.
2. Keep current scalar fields.
3. Add optional plural fields and debug metadata.
4. Add parser instance API.
5. Add optional utilities through explicit exports.
6. Only change defaults in a major version.

## Suggested Priority Order

Highest priority:

1. Preserve current behavior in fixtures.
2. Build tokenizer and span utilities.
3. Build candidate extractor model.
4. Build conflict resolver.
5. Replace destructive title/excess logic.

Medium priority:

6. Add TypeScript result and rule types.
7. Add debug output.
8. Add parser instance API.
9. Expand modern coverage.
10. Add plural fields.

Lower priority:

11. Add title similarity helper.
12. Add ranking/filtering helpers.
13. Add optional file metadata as separate export or package.

Publishing priority:

14. Make `exports` explicit and complete.
15. Validate with `publint`.
16. Validate with `@arethetypeswrong/cli` / ATTW.
17. Verify packed package behavior before release.

## Final Guiding Principle

The core parser should remain small, deterministic, and explainable.

Modernizing this package does not mean making it abstract or heavy. It means
making each parser decision visible:

- what text was recognized
- which rule recognized it
- why it won over other candidates
- which spans were consumed
- how title/group/excess were inferred
- what raw value was preserved
- what normalized value was optionally produced

That is the difference between a regex pile and a modern parser.
