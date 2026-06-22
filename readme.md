# parse-torrent-name

> **Status: pre-release, in active development.** This repository on `main`
> contains a parser rewrite that has not been published to npm yet. The
> package on npm (`parse-torrent-name@0.5.x`) is still the older
> `jzjzjzj/parse-torrent-name` line. Until a tagged release ships, the public
> API and parsed field set are subject to change. Use the pinned npm version
> if you need stability, or track `main` if you want the work described below.

A small, deterministic parser for movie and TV torrent release names.

## Evolution From The Base

This project started as a fork of
[jzjzjzj/parse-torrent-name](https://github.com/jzjzjzj/parse-torrent-name),
which is a flat, regex-driven parser that mutates a working string as it goes.
That style is hard to extend and almost impossible to debug.

The rewrite on `main` replaces the coupled regex-plus-mutation model with a
span-aware pipeline:

```
input -> preprocess -> tokenize -> extract candidates
       -> resolve conflicts -> infer title / episodeName / group / excess
       -> project to public result -> optionally normalize
```

Every parser decision is now backed by an explicit candidate with a span, a
priority, and a confidence. Conflicts are decided by the resolver, not by
rule order. The result is a parser that is small, explainable, and extensible
without forking.

Detailed design notes live in
[`MODERNIZATION_ROADMAP.md`](./MODERNIZATION_ROADMAP.md).

## What Is New In The Rewrite

These are the public surfaces that did not exist in the base fork and that
all of the verified examples below exercise.

- **Span-based candidate extraction.** Every recognized field is a candidate
  with `start`, `end`, `priority`, `confidence`, `source`, and `consumes`.
- **Conflict resolution.** Overlapping candidates are resolved deterministically
  and rejected candidates are kept for inspection.
- **`includeDebug` option.** Returns the full candidate set, the accepted
  set, the rejected set, the consumed/unconsumed spans, and a resolution
  trace alongside the normal parsed result.
- **`Parser` instance API.** Create a parser, add custom rules, or load a
  rule pack without forking the package. Custom rules are additive: they
  add fields the default parser does not already produce.
- **Separate utility entry points.** `parse-torrent-name/normalize` and
  `parse-torrent-name/similarity` are exported as their own entry points so
  the parser core stays policy-free.
- **TypeScript declarations.** `index.d.ts`, `normalize.d.ts`, and
  `similarity.d.ts` ship with the package.
- **Packaging validation.** `publint` and `@arethetypeswrong/cli` run on
  `prepublishOnly`.

## Install

```bash
npm install parse-torrent-name
```

> Note: the published `0.5.x` line on npm does **not** include the rewrite
> described above. The examples below are accurate against the current
> `main` branch and will be accurate against the next published release.

## Usage

### Basic parse

```js
const ptn = require("parse-torrent-name");

ptn("The.Staying.Alive.S05E02.720p.HDTV.x264-KILLERS[rartv]");
// {
//   title: "The Staying Alive",
//   season: 5,
//   episode: 2,
//   resolution: "720p",
//   quality: "HDTV",
//   source: "hdtv",
//   codec: "x264",
//   group: "KILLERS[rartv]"
// }
```

### TV show with episode name

```js
ptn("Game.of.Thrones.S04E03.Breaker.of.Chains.1080p.WEB-DL.DD5.1-GRP");
// {
//   title: "Game of Thrones",
//   season: 4,
//   episode: 3,
//   episodeName: "Breaker of Chains",
//   resolution: "1080p",
//   quality: "WEB-DL",
//   source: "web-dl",
//   audio: "DD5.1",
//   group: "GRP"
// }
```

`episodeName` is now produced from candidate spans rather than from
destructive string replacement, so the same release that previously lost the
episode title parses correctly.

### Encoder and group from a `-Encoder-GROUP` release

```js
ptn("Movie.2024.1080p.BluRay.x264-Encoder-GRP");
// {
//   title: "Movie",
//   year: 2024,
//   resolution: "1080p",
//   quality: "BluRay",
//   source: "bluray",
//   codec: "x264",
//   encoder: "Encoder",
//   group: "GRP"
// }
```

The new candidate-based group inference splits the final hyphen-separated
suffix into `encoder` and `group` only when the structure supports it, and
falls back to a single `group` for legacy non-hyphen releases.

### Normalized output

```js
ptn("Movie.2024.2160p.AMZN.WEB-DL.DDP5.1.Atmos.DV.HDR10.HEVC-NTb", {
  normalize: true,
});
// {
//   title: "Movie",
//   year: 2024,
//   resolution: "2160p",
//   quality: "WEB-DL",
//   source: "web-dl",
//   codec: "HEVC",
//   audio: "DDP",
//   atmos: true,
//   colors: ["HDR10", "DV"],
//   color: "HDR10",
//   service: "AMZN",
//   group: "NTb",
//   normalized: {
//     title: "movie",
//     type: "movie",
//     resolution: "uhd",
//     source: "webdl",
//     releaseType: "web",
//     codec: "hevc",
//     audio: ["ddp", "atmos"],
//     hdr: ["hdr10", "dolby_vision"],
//     service: "amazon"
//   }
// }
```

Top-level fields preserve parsed release text where possible. The
`normalized` object is intended for filtering, ranking, search, and
deduplication. Both `color` (the first detected color) and `colors` (the full
list) are returned.

### Debug output

```js
ptn("Movie.2024.1080p.WEB-DL.DDP5.1-GRP", { includeDebug: true }).debug;
// {
//   candidates: [ ... ],
//   accepted:   [ ... ],
//   rejected:   [ ... ],
//   consumedSpans:          [ ... ],
//   resolvedConsumedSpans:  [ ... ],
//   resolvedUnconsumedSpans: [ ... ],
//   trace:                  [ ... ]
// }
```

`rejected` is useful for understanding overlaps. In the example above, the
embedded `5.1` channels candidate is rejected because the `DDP5.1` audio
candidate already covers the same span:

```js
[
  {
    candidate: { field: "channels", raw: "5.1", source: "channels.embedded-audio", start: 27, end: 30, ... },
    rejectedBy: { field: "audio",    raw: "DDP5.1", source: "audio.standard",     start: 24, end: 30, ... },
    reason: "overlap"
  }
]
```

`resolvedUnconsumedSpans` are the spans that were not claimed by any accepted
candidate. Together with `trace` they explain exactly how a result was
produced. Debug details are intended for parser inspection and may be less
stable than the top-level parsed fields.

### Custom rules with `Parser`

```js
const ptn = require("parse-torrent-name");

const parser = new ptn.Parser();

parser.addRule({
  id: "custom.edition",
  field: "edition",
  priority: 60,
  match(ctx) {
    const m = ctx.input.match(/\b(Criterion|IMAX|Remastered|Anniversary)\b/i);
    if (!m) return [];

    return [{
      field: "edition",
      raw: m[0],
      value: m[0],
      start: m.index,
      end: m.index + m[0].length,
      priority: 60,
      confidence: 0.9,
      source: "custom.edition",
      consumes: true,
    }];
  },
});

parser.parse("Movie.2024.1080p.BluRay.x264-Criterion-GRP");
// {
//   title: "Movie",
//   year: 2024,
//   resolution: "1080p",
//   quality: "BluRay",
//   source: "bluray",
//   codec: "x264",
//   encoder: "Criterion",
//   group: "GRP",
//   edition: "Criterion"
// }
```

Custom rules are additive: they add fields the default parser does not
already return. The default `ptn(name)` API remains preconfigured and
unchanged. A custom rule can also be loaded as part of a rule pack with
`parser.use(pack)` where `pack` is an array of rules or `{ rules: [...] }`.

### Optional utilities

```js
const normalizeTitle  = require("parse-torrent-name/normalize");
const titleSimilarity = require("parse-torrent-name/similarity");

normalizeTitle("Amelie & Co.");          // "amelie and co"
titleSimilarity("Spider-Man", "Spider Man"); // 1
```

`titleSimilarity` returns a Sørensen–Dice-style score in `[0, 1]` over
unique normalized tokens, which is useful for collapsing near-duplicate
releases before ranking:

```js
titleSimilarity("Game of Thrones", "Game.of.Thrones"); // 1
titleSimilarity("Movie 2024",      "Movie 2025");      // 0.5
```

These helpers are intentionally separate from `ptn(name)` so the parser core
stays deterministic and policy-free.

## Parsed Fields

The current public field set is:

- `title`, `normalizedTitle`, `year`
- `season`, `episode` (or array of episodes when multiple are present),
  `episodeName`
- `resolution`, `quality`, `source`, `service`, `codec`, `audio`, `audios`,
  `atmos`, `channels`, `color`, `colors`, `language`, `languages`,
  `container`
- `bitdepth`, `samplerate`
- `group`, `encoder`, `region`, `website`, `excess`, `garbage`
- release flags: `extended`, `theatrical`, `uncut`, `unrated`, `openmatte`,
  `hybrid`, `remux`, `hardcoded`, `proper`, `repack`, `internal`, `retail`,
  `remastered`, `widescreen`
- `normalized` (only when `{ normalize: true }` is passed)
- `debug` (only when `{ includeDebug: true }` is passed)

Custom rules from a `Parser` instance can add additional fields with
arbitrary names.

## In Progress And Not Yet Shipped

These items are tracked in
[`MODERNIZATION_ROADMAP.md`](./MODERNIZATION_ROADMAP.md) and are part of the
rewrite, but the corresponding work has not landed on `main` yet:

- Broader modern release coverage (DS4K, CONVERT, Criterion, IMAX, Extras,
  anime and scene naming fixtures, plural field expansion)
- The remaining optional utility entry points (`scoreTorrent`,
  `filterTorrent`, `sortTorrents`, `isAcceptable`)
- Packed-tarball smoke tests and CI for `publint` and
  `@arethetypeswrong/cli`

Known limitations of the current `main` build that are explicitly on the
roadmap:

- Anime-style names with bracketed tags can still bleed tag content into the
  inferred title. The bracket-aware tokenizer in place, but anime-specific
  title inference is not yet wired in.
- Multi-episode releases like `S02E05E06` only return the first episode
  number in `episode`; the array form is declared in the types but not yet
  produced by the candidate stage.

## Development

```bash
npm test
npm run benchmark
npm run lint:package
```

`npm run lint:package` runs `publint` and `@arethetypeswrong/cli` against
the current package layout and is also wired into `prepublishOnly`.

## License

ISC. The original `jzjzjzj/parse-torrent-name` source is MIT-licensed; ideas
from `parse-torrent-title` and `rank-torrent-name` are referenced in the
roadmap. Attribution and license notices are preserved where borrowed.
