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
