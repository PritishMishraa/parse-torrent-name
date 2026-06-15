"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var extractors = require("./candidate-extractors");
var ptn = require("./");

var simplify = function (candidate) {
  return {
    field: candidate.field,
    raw: candidate.raw,
    value: candidate.value,
    start: candidate.start,
    end: candidate.end,
    priority: candidate.priority,
    source: candidate.source,
    consumes: candidate.consumes,
  };
};

var findCandidate = function (candidates, field, raw) {
  return candidates.find(function (candidate) {
    return candidate.field === field && candidate.raw === raw;
  });
};

test("extracts high-confidence candidates with spans and rule metadata", function () {
  var input =
    "[Site] Movie.Name.S01E02.2024.2160p.AMZN.WEB-DL.DDP5.1.Atmos.DV.HDR10.HEVC-NTb";
  var candidates = extractors.extractCandidates(input);

  assert.deepEqual(simplify(findCandidate(candidates, "website", "[Site]")), {
    field: "website",
    raw: "[Site]",
    value: "Site",
    start: 0,
    end: 6,
    priority: extractors.PRIORITY.STRUCTURAL,
    source: "website.prefix",
    consumes: true,
  });

  assert.deepEqual(simplify(findCandidate(candidates, "season", "S01E02")), {
    field: "season",
    raw: "S01E02",
    value: 1,
    start: 18,
    end: 24,
    priority: extractors.PRIORITY.STRUCTURAL,
    source: "episode.sxxexx",
    consumes: true,
  });

  assert.deepEqual(simplify(findCandidate(candidates, "episode", "S01E02")), {
    field: "episode",
    raw: "S01E02",
    value: 2,
    start: 18,
    end: 24,
    priority: extractors.PRIORITY.STRUCTURAL,
    source: "episode.sxxexx",
    consumes: true,
  });

  assert.equal(findCandidate(candidates, "year", "2024").value, 2024);
  assert.equal(findCandidate(candidates, "resolution", "2160p").value, "2160p");
  assert.equal(findCandidate(candidates, "service", "AMZN").value, "AMZN");
  assert.equal(findCandidate(candidates, "source", "WEB-DL").value, "web-dl");
  assert.equal(findCandidate(candidates, "audio", "DDP5.1").value, "DDP");
  assert.equal(findCandidate(candidates, "channels", "5.1").value, "5.1");
  assert.equal(findCandidate(candidates, "atmos", "Atmos").value, true);
  assert.equal(findCandidate(candidates, "colors", "DV").value, "DV");
  assert.equal(findCandidate(candidates, "colors", "HDR10").value, "HDR10");
  assert.equal(findCandidate(candidates, "codec", "HEVC").value, "HEVC");
  assert.equal(findCandidate(candidates, "group", "-NTb").value, "NTb");
});

test("extracts 1x02 season and episode candidates from the same span", function () {
  var candidates = extractors.extractCandidates("Show.Name.4x03.720p.HDTV.x264-GRP");
  var season = findCandidate(candidates, "season", "4x03");
  var episode = findCandidate(candidates, "episode", "4x03");

  assert.equal(season.value, 4);
  assert.equal(episode.value, 3);
  assert.equal(season.start, episode.start);
  assert.equal(season.end, episode.end);
});

test("extracts season and episode candidates from phrase markers", function () {
  var candidates = extractors.extractCandidates(
    "Some.Show.Season.2.Episode.10.1080p.NFLX.WEBRip.AV1.Opus.2.0-GRP",
  );
  var season = findCandidate(candidates, "season", "Season.2.Episode.10");
  var episode = findCandidate(candidates, "episode", "Season.2.Episode.10");

  assert.equal(season.value, 2);
  assert.equal(episode.value, 10);
  assert.equal(season.source, "episode.sxxexx");
  assert.equal(episode.source, "episode.sxxexx");
});

test("does not extract a release year from S2024E01 style episode markers", function () {
  var candidates = extractors.extractCandidates("Future.Show.S2024E01.1080p.WEB-DL");

  assert.equal(findCandidate(candidates, "year", "2024"), undefined);
});

test("keeps specific technical candidates intact", function () {
  var candidates = extractors.extractCandidates(
    "Movie.2024.DTS-HD.MA.HDR10+.BluRay.x265-GRP",
  );

  assert.equal(findCandidate(candidates, "audio", "DTS-HD.MA").value, "DTS-HD MA");
  assert.equal(findCandidate(candidates, "colors", "HDR10+").value, "HDR10+");
  assert.equal(findCandidate(candidates, "source", "BluRay").value, "bluray");
  assert.equal(findCandidate(candidates, "codec", "x265").value, "HEVC");
});

test("extracts language, container, region, and release flag candidates", function () {
  var candidates = extractors.extractCandidates(
    "Movie.2024.R6.ENG.MULTi.HC.REAL.PROPER.RETAIL.WS.1080p.WEB-DL.MKV-GRP",
  );

  assert.equal(findCandidate(candidates, "region", "R6").value, "R6");
  assert.equal(findCandidate(candidates, "language", "ENG").value, "eng");
  assert.equal(findCandidate(candidates, "language", "MULTi").value, "multi");
  assert.equal(findCandidate(candidates, "flags", "HC").value, "hardcoded");
  assert.equal(findCandidate(candidates, "flags", "REAL.PROPER").value, "proper");
  assert.equal(findCandidate(candidates, "flags", "RETAIL").value, "retail");
  assert.equal(findCandidate(candidates, "flags", "WS").value, "widescreen");
  assert.equal(findCandidate(candidates, "container", "MKV").value, "MKV");
});

test("extracts legacy title-boundary source and garbage candidates", function () {
  var ppvCandidates = extractors.extractCandidates("UFC.179.PPV.HDTV.x264-Ebi");
  var dateCandidates = extractors.extractCandidates(
    "WWE Monday Night Raw 3rd Nov 2014 HDTV x264-Sir Paul",
  );

  assert.equal(findCandidate(ppvCandidates, "source", "PPV.HDTV").value, "hdtv");
  assert.equal(findCandidate(dateCandidates, "garbage", "3rd Nov").value, "3rd Nov");
});

test("extracts a focused title-boundary candidate subset", function () {
  var candidates = extractors.extractTitleCandidates(
    "[Site] Movie.Name.S01E02.2024.1080p.WEB-DL.DDP5.1.x264-GRP",
  );

  assert.equal(findCandidate(candidates, "website", "[Site]").value, "Site");
  assert.equal(findCandidate(candidates, "season", "S01E02").value, 1);
  assert.equal(findCandidate(candidates, "episode", "S01E02").value, 2);
  assert.equal(findCandidate(candidates, "year", "2024").value, 2024);
  assert.equal(findCandidate(candidates, "resolution", "1080p").value, "1080p");
  assert.equal(findCandidate(candidates, "source", "WEB-DL").value, "web-dl");
  assert.equal(findCandidate(candidates, "audio", "DDP5.1"), undefined);
  assert.equal(findCandidate(candidates, "codec", "x264"), undefined);
});

test("extracts a focused episode-name boundary candidate subset", function () {
  var candidates = extractors.extractEpisodeNameCandidates(
    "Community.s02e20.rus.eng.720p.Kybik.v.Kybe",
  );

  assert.equal(findCandidate(candidates, "episode", "s02e20").value, 20);
  assert.equal(findCandidate(candidates, "language", "rus.eng").value, "rus.eng");
  assert.equal(findCandidate(candidates, "resolution", "720p").value, "720p");
  assert.equal(findCandidate(candidates, "group", "Kybik.v.Kybe"), undefined);
});

test("extracts audio detail candidates", function () {
  var candidates = extractors.extractCandidates(
    "Film.2022.1080p.HMAX.WEB-DL.FLAC.24bit.48kHz.x265-Group",
  );

  assert.equal(findCandidate(candidates, "bitdepth", "24bit").value, 24);
  assert.equal(findCandidate(candidates, "samplerate", "48kHz").value, 48);
  assert.equal(findCandidate(candidates, "audio", "FLAC").value, "FLAC");
});

test("extracts conservative encoder candidates before a final group", function () {
  var candidates = extractors.extractCandidates(
    "Movie.2024.1080p.BluRay.x264-SomeEncoder-GRP",
  );
  var encoder = findCandidate(candidates, "encoder", "SomeEncoder");
  var group = findCandidate(candidates, "group", "-GRP");

  assert.equal(encoder.value, "SomeEncoder");
  assert.equal(encoder.source, "encoder.before-final-group");
  assert.equal(group.value, "GRP");
});

test("candidate extractors are internal and do not change public parser output", function () {
  var input =
    "Example.Movie.2024.2160p.AMZN.WEB-DL.DDP5.1.Atmos.DV.HDR10.HEVC-NTb";

  assert.deepEqual(ptn(input), {
    year: 2024,
    resolution: "2160p",
    quality: "WEB-DL",
    source: "web-dl",
    codec: "HEVC",
    audio: "DDP",
    atmos: true,
    colors: ["HDR10", "DV"],
    color: "HDR10",
    service: "AMZN",
    group: "NTb",
    title: "Example Movie",
  });
});
