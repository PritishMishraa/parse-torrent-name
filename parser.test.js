"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var ptn = require("./");

var partRule = {
  id: "custom.part",
  field: "part",
  priority: 70,
  match: function (ctx) {
    var match = ctx.input.match(/(?:^|[. _-])Part[. _-]?([0-9]+)(?:$|[. _-])/i);

    if (!match) {
      return [];
    }

    return [
      {
        field: "part",
        raw: match[0],
        value: parseInt(match[1], 10),
        start: match.index,
        end: match.index + match[0].length,
        priority: this.priority,
        confidence: 1,
        source: this.id,
        consumes: true,
      },
    ];
  },
};

test("default parser remains the simple public API", function () {
  assert.equal(ptn("Movie.Part.2.2024.1080p.WEB-DL-GRP").part, undefined);
});

test("custom parser rules can add fields without changing package source", function () {
  var parser = new ptn.Parser();
  var parsed;

  parser.addRule(partRule);
  parsed = parser.parse("Movie.Part.2.2024.1080p.WEB-DL-GRP");

  assert.equal(parsed.title, "Movie Part 2");
  assert.equal(parsed.year, 2024);
  assert.equal(parsed.part, 2);
});

test("custom parser accepts rule packs", function () {
  var parser = new ptn.Parser();
  var parsed;

  parser.use({ rules: [partRule] });
  parsed = parser.parse("Movie.Part.3.2024.1080p.WEB-DL-GRP", {
    includeDebug: true,
  });

  assert.equal(parsed.part, 3);
  assert.equal(parsed.debug.customAccepted[0].field, "part");
  assert.equal(parsed.debug.customAccepted[0].value, 3);
});

test("custom parser validates rules", function () {
  var parser = new ptn.Parser();

  assert.throws(function () {
    parser.addRule({ id: "bad" });
  }, /match/);

  assert.throws(function () {
    parser.use({ rules: null });
  }, /rule pack/);
});
