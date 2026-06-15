"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var extractors = require("./candidate-extractors");
var inference = require("./inference");
var resolver = require("./resolver");

var inferTitle = function (input) {
  var resolved = resolver.resolveCandidates(
    input,
    extractors.extractCandidates(input),
  );

  return inference.inferTitle(input, resolved.accepted);
};

var inferEpisodeName = function (input) {
  var resolved = resolver.resolveCandidates(
    input,
    extractors.extractEpisodeNameCandidates(input),
  );

  return inference.inferEpisodeName(input, resolved.accepted);
};

var inferGroupAndEncoder = function (input) {
  var resolved = resolver.resolveCandidates(
    input,
    extractors.extractGroupCandidates(input),
  );

  return inference.inferGroupAndEncoder(input, resolved.accepted);
};

test("infers title from leading unconsumed spans before release metadata", function () {
  assert.deepEqual(
    inferTitle("Movie.Name.2024.2160p.WEB-DL.DDP5.1.HEVC-GRP"),
    {
      name: "title",
      raw: "Movie.Name.",
      clean: "Movie Name",
      start: 0,
      end: 11,
    },
  );
});

test("skips website prefixes when inferring title", function () {
  assert.deepEqual(
    inferTitle("[ www.Speed.cd ] -Sons.of.Anarchy.S07E07.720p.HDTV.X264-DIMENSION"),
    {
      name: "title",
      raw: "Sons.of.Anarchy.",
      clean: "Sons of Anarchy",
      start: 18,
      end: 34,
    },
  );
});

test("keeps legacy dotted initial cleanup behavior", function () {
  assert.equal(
    inferTitle("Marvels Agents of S.H.I.E.L.D. S02E06 HDTV x264-KILLERS[ettv]")
      .clean,
    "Marvels Agents of S.H.I.E.L.D.",
  );
});

test("keeps parenthesized leftovers available for excess inference", function () {
  assert.deepEqual(
    inferTitle("Teenage Mutant Ninja Turtles (unknown_release_type / 2014)"),
    {
      name: "title",
      raw: "Teenage Mutant Ninja Turtles ",
      clean: "Teenage Mutant Ninja Turtles",
      start: 0,
      end: 53,
    },
  );
});

test("infers episode name between episode marker and release metadata", function () {
  assert.deepEqual(
    inferEpisodeName("Gotham.S01E07.Penguins.Umbrella.WEB-DL.x264.AAC"),
    {
      name: "episodeName",
      raw: ".Penguins.Umbrella.",
      clean: "Penguins Umbrella",
      start: 13,
      end: 32,
    },
  );
});

test("infers episode name after dashed episode markers without release metadata", function () {
  assert.deepEqual(
    inferEpisodeName("Game of Thrones - 4x03 - Breaker of Chains"),
    {
      name: "episodeName",
      raw: " - Breaker of Chains",
      clean: "Breaker of Chains",
      start: 22,
      end: 42,
    },
  );
});

test("does not infer language metadata as an episode name", function () {
  assert.equal(
    inferEpisodeName("Community.s02e20.rus.eng.720p.Kybik.v.Kybe"),
    undefined,
  );
});

test("infers final hyphen release groups from accepted spans", function () {
  assert.deepEqual(
    inferGroupAndEncoder("Movie.2024.1080p.WEB-DL.x264-GRP"),
    {
      group: {
        name: "group",
        raw: "-GRP",
        clean: "GRP",
        start: 28,
        end: 32,
      },
    },
  );
});

test("infers conservative encoder before final release group", function () {
  assert.deepEqual(
    inferGroupAndEncoder("Movie.2024.1080p.BluRay.x264-SomeEncoder-GRP"),
    {
      group: {
        name: "group",
        raw: "-GRP",
        clean: "GRP",
        start: 40,
        end: 44,
      },
      encoder: {
        name: "encoder",
        raw: "SomeEncoder",
        clean: "SomeEncoder",
        start: 29,
        end: 40,
      },
    },
  );
});

test("does not infer spaced dashed episode names as release groups", function () {
  assert.deepEqual(
    inferGroupAndEncoder("Game of Thrones - 4x03 - Breaker of Chains"),
    {},
  );
});
