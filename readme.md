# parse-torrent-name

Small deterministic parser for movie and TV torrent release names.

This is a fork of [jzjzjzj/parse-torrent-name](https://github.com/jzjzjzj/parse-torrent-name) with modern release-name coverage and ongoing parser modernization.

## Install

```bash
npm install parse-torrent-name
```

## Usage

```js
const ptn = require("parse-torrent-name");

ptn("The.Staying.Alive.S05E02.720p.HDTV.x264-KILLERS[rartv]");
/*
{
  season: 5,
  episode: 2,
  resolution: "720p",
  quality: "HDTV",
  codec: "x264",
  group: "KILLERS[rartv]",
  title: "The Staying Alive"
}
*/
```

Normalized output is opt-in:

```js
ptn("Movie.2024.2160p.AMZN.WEB-DL.DDP5.1.Atmos.DV.HDR10.HEVC-NTb", {
  normalize: true,
});
/*
{
  title: "Movie",
  year: 2024,
  resolution: "2160p",
  quality: "WEB-DL",
  source: "web-dl",
  codec: "HEVC",
  audio: "DDP",
  atmos: true,
  colors: ["HDR10", "DV"],
  service: "AMZN",
  group: "NTb",
  normalized: {
    title: "movie",
    type: "movie",
    resolution: "uhd",
    source: "webdl",
    releaseType: "web",
    codec: "hevc",
    audio: ["ddp", "atmos"],
    hdr: ["hdr10", "dolby_vision"],
    service: "amazon"
  }
}
*/
```

Top-level fields preserve parsed release text where possible. The `normalized`
object is intended for filtering, ranking, search, and deduplication.

Debug output is also opt-in:

```js
ptn("Movie.2024.1080p.WEB-DL.DDP5.1-GRP", {
  includeDebug: true,
});
/*
{
  title: "Movie",
  year: 2024,
  resolution: "1080p",
  quality: "WEB-DL",
  audio: "DDP",
  group: "GRP",
  debug: {
    candidates: [ ... ],
    accepted: [ ... ],
    rejected: [ ... ],
    consumedSpans: [ ... ],
    resolvedConsumedSpans: [ ... ],
    resolvedUnconsumedSpans: [ ... ],
    trace: [ ... ]
  }
}
*/
```

Debug details are intended for parser inspection and may be less stable than
the top-level parsed fields.

Custom parser instances can add project-specific rules without forking:

```js
const parser = new ptn.Parser();

parser.addRule({
  id: "custom.part",
  field: "part",
  priority: 70,
  match(ctx) {
    const match = ctx.input.match(/(?:^|[. _-])Part[. _-]?([0-9]+)/i);

    if (!match) return [];

    return [{
      field: "part",
      raw: match[0],
      value: Number(match[1]),
      start: match.index,
      end: match.index + match[0].length,
      priority: 70,
      confidence: 1,
      source: "custom.part",
      consumes: true
    }];
  }
});

parser.parse("Movie.Part.2.2024.1080p.WEB-DL-GRP");
```

Custom rules are additive: they can add fields that the default parser does not
already return. The default `ptn(name)` API remains preconfigured and unchanged.

Optional utilities are available from separate entry points:

```js
const normalizeTitle = require("parse-torrent-name/normalize");
const titleSimilarity = require("parse-torrent-name/similarity");

normalizeTitle("Amelie & Co."); // "amelie and co"
titleSimilarity("Spider-Man", "Spider Man"); // 1
```

These helpers are intentionally separate from `ptn(name)` so parsing stays
deterministic and policy-free.

## Parsed Fields

Common fields include `title`, `year`, `season`, `episode`, `episodeName`,
`resolution`, `quality`, `source`, `service`, `codec`, `audio`, `channels`,
`color`, `colors`, `language`, `container`, `group`, `encoder`, `website`,
`excess`, and release flags such as `proper`, `repack`, `remux`, `hybrid`,
`hardcoded`, `extended`, `uncut`, `unrated`, `retail`, `remastered`, and
`widescreen`.

## Development

```bash
npm test
npm run benchmark
npm run lint:package
```
