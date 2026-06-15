"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var normalizeTitle = require("./normalize");
var titleSimilarity = require("./similarity");

test("normalizes titles for comparison", function () {
  assert.equal(normalizeTitle("Amelie & Co."), "amelie and co");
  assert.equal(normalizeTitle("Spider-Man: No Way Home"), "spider man no way home");
  assert.equal(normalizeTitle("  WALL·E  "), "wall e");
});

test("exposes named utility properties for CommonJS consumers", function () {
  assert.equal(normalizeTitle.normalizeTitle("A_B"), "a b");
  assert.equal(titleSimilarity.titleSimilarity("Spider-Man", "Spider Man"), 1);
});

test("scores normalized title similarity without parser side effects", function () {
  assert.equal(titleSimilarity("Spider-Man", "Spider Man"), 1);
  assert.equal(titleSimilarity("", ""), 1);
  assert.equal(titleSimilarity("Movie", ""), 0);
  assert.ok(titleSimilarity("The Matrix Reloaded", "Matrix Reloaded") > 0.75);
  assert.ok(titleSimilarity("The Matrix", "Finding Nemo") < 0.5);
});
