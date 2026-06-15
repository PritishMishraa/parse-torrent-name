"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var tokenizer = require("./tokenizer");

test("tokenizes release names with raw spans and separators", function () {
  var tokens = tokenizer.tokenize("Movie.Name.2024.1080p.WEB-DL-GRP");

  assert.deepEqual(
    tokens.map(function (token) {
      return {
        raw: token.raw,
        start: token.start,
        end: token.end,
        separatorBefore: token.separatorBefore,
        separatorAfter: token.separatorAfter,
      };
    }),
    [
      { raw: "Movie", start: 0, end: 5, separatorBefore: "", separatorAfter: "." },
      { raw: "Name", start: 6, end: 10, separatorBefore: ".", separatorAfter: "." },
      { raw: "2024", start: 11, end: 15, separatorBefore: ".", separatorAfter: "." },
      { raw: "1080p", start: 16, end: 21, separatorBefore: ".", separatorAfter: "." },
      { raw: "WEB", start: 22, end: 25, separatorBefore: ".", separatorAfter: "-" },
      { raw: "DL", start: 26, end: 28, separatorBefore: "-", separatorAfter: "-" },
      { raw: "GRP", start: 29, end: 32, separatorBefore: "-", separatorAfter: "" },
    ],
  );
});

test("preserves bracket context on tokens", function () {
  var tokens = tokenizer.tokenize("[Site] Movie.Name (2024) {Edition}");

  assert.deepEqual(
    tokens.map(function (token) {
      return {
        raw: token.raw,
        bracket: token.bracket,
      };
    }),
    [
      { raw: "Site", bracket: "square" },
      { raw: "Movie", bracket: undefined },
      { raw: "Name", bracket: undefined },
      { raw: "2024", bracket: "round" },
      { raw: "Edition", bracket: "curly" },
    ],
  );
});

test("normalizes tokens without changing raw values", function () {
  var tokens = tokenizer.tokenize("Amelie.Episode");

  assert.equal(tokens[0].raw, "Amelie");
  assert.equal(tokens[0].normalized, "amelie");
});

test("detects overlapping spans", function () {
  assert.equal(
    tokenizer.overlaps({ start: 5, end: 10 }, { start: 9, end: 12 }),
    true,
  );
  assert.equal(
    tokenizer.overlaps({ start: 5, end: 10 }, { start: 10, end: 12 }),
    false,
  );
});

test("merges overlapping or adjacent spans", function () {
  assert.deepEqual(
    tokenizer.mergeSpans([
      { start: 10, end: 12 },
      { start: 1, end: 4 },
      { start: 3, end: 8 },
      { start: 8, end: 9 },
    ]),
    [
      { start: 1, end: 9 },
      { start: 10, end: 12 },
    ],
  );
});
