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
