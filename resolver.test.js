"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var extractors = require("./candidate-extractors");
var resolver = require("./resolver");

var candidate = function (field, raw, value, start, end, priority, source) {
  return {
    field: field,
    raw: raw,
    value: value,
    start: start,
    end: end,
    priority: priority,
    confidence: 1,
    source: source || field + ".test",
    consumes: true,
  };
};

var simplify = function (candidate) {
  return {
    field: candidate.field,
    raw: candidate.raw,
    value: candidate.value,
    start: candidate.start,
    end: candidate.end,
    source: candidate.source,
  };
};

test("accepts different fields from the same structural episode span", function () {
  var result = resolver.resolveCandidates("Show.S01E02.1080p", [
    candidate("season", "S01E02", 1, 5, 11, extractors.PRIORITY.STRUCTURAL, "episode.sxxexx"),
    candidate("episode", "S01E02", 2, 5, 11, extractors.PRIORITY.STRUCTURAL, "episode.sxxexx"),
  ]);

  assert.deepEqual(result.accepted.map(simplify), [
    {
      field: "season",
      raw: "S01E02",
      value: 1,
      start: 5,
      end: 11,
      source: "episode.sxxexx",
    },
    {
      field: "episode",
      raw: "S01E02",
      value: 2,
      start: 5,
      end: 11,
      source: "episode.sxxexx",
    },
  ]);
  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.consumedSpans, [{ start: 5, end: 11 }]);
});

test("rejects a lower-priority year candidate inside an episode marker", function () {
  var result = resolver.resolveCandidates("Future.Show.S2024E01.1080p", [
    candidate("season", "S2024E01", 2024, 12, 20, extractors.PRIORITY.STRUCTURAL, "episode.sxxexx"),
    candidate("episode", "S2024E01", 1, 12, 20, extractors.PRIORITY.STRUCTURAL, "episode.sxxexx"),
    candidate("year", "2024", 2024, 13, 17, extractors.PRIORITY.TECHNICAL, "year.bounded"),
  ]);

  assert.deepEqual(
    result.accepted.map(function (item) {
      return item.field;
    }),
    ["season", "episode"],
  );
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].candidate.field, "year");
  assert.equal(result.rejected[0].rejectedBy.field, "season");
  assert.equal(result.rejected[0].reason, "overlap");
});

test("prefers longer same-priority technical candidates over partial matches", function () {
  var result = resolver.resolveCandidates("Movie.DTS-HD.MA.HDR10+", [
    candidate("audio", "DTS", "DTS", 6, 9, extractors.PRIORITY.TECHNICAL, "audio.weak"),
    candidate("audio", "DTS-HD.MA", "DTS-HD MA", 6, 15, extractors.PRIORITY.TECHNICAL, "audio.specific"),
    candidate("colors", "HDR10", "HDR10", 16, 21, extractors.PRIORITY.TECHNICAL, "color.weak"),
    candidate("colors", "HDR10+", "HDR10+", 16, 22, extractors.PRIORITY.TECHNICAL, "color.specific"),
  ]);

  assert.deepEqual(
    result.accepted.map(function (item) {
      return item.raw;
    }),
    ["DTS-HD.MA", "HDR10+"],
  );
  assert.deepEqual(
    result.rejected.map(function (item) {
      return item.candidate.raw;
    }),
    ["DTS", "HDR10"],
  );
});

test("tracks consumed and unconsumed spans from extracted candidates", function () {
  var input = "[Site] Movie.Name.S01E02.1080p.WEB-DL-GRP";
  var result = resolver.resolveCandidates(input, extractors.extractCandidates(input));

  assert.deepEqual(result.consumedSpans, [
    { start: 0, end: 6 },
    { start: 18, end: 24 },
    { start: 25, end: 30 },
    { start: 31, end: 41 },
  ]);
  assert.deepEqual(result.unconsumedSpans, [
    { start: 6, end: 18, raw: " Movie.Name." },
    { start: 24, end: 25, raw: "." },
    { start: 30, end: 31, raw: "." },
  ]);
});
