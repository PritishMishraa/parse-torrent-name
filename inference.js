"use strict";

var TITLE_BOUNDARY_FIELDS = {
  atmos: true,
  audio: true,
  bitdepth: true,
  channels: true,
  codec: true,
  colors: true,
  container: true,
  episode: true,
  flags: true,
  garbage: true,
  language: true,
  region: true,
  resolution: true,
  samplerate: true,
  season: true,
  service: true,
  source: true,
  year: true,
};

var TITLE_PREFIX_FIELDS = {
  website: true,
};

var trimLeadingSeparators = function (input, start) {
  var cursor = start;

  while (cursor < input.length && /[\s._-]/.test(input[cursor])) {
    cursor += 1;
  }

  return cursor;
};

var findTitleStart = function (input, candidates) {
  var start = 0;

  candidates.forEach(function (candidate) {
    if (
      TITLE_PREFIX_FIELDS[candidate.field] &&
      candidate.start === start &&
      candidate.end > start
    ) {
      start = trimLeadingSeparators(input, candidate.end);
    }
  });

  return start;
};

var findTitleEnd = function (start, candidates) {
  var end;

  candidates.forEach(function (candidate) {
    if (!TITLE_BOUNDARY_FIELDS[candidate.field] || candidate.start < start) {
      return;
    }

    if (end === undefined || candidate.start < end) {
      end = candidate.start;
    }
  });

  return end;
};

var cleanTitle = function (raw) {
  var clean = String(raw || "");

  clean = clean.replace(/^[\s._-]+/, "");

  if (clean.indexOf(" ") === -1 && clean.indexOf(".") !== -1) {
    clean = clean.replace(/\./g, " ");
  }

  clean = clean.replace(/_/g, " ");
  clean = clean.replace(/[\s_-]+$/, "");

  return clean.trim();
};

var inferTitle = function (input, candidates) {
  var source = String(input || "");
  var accepted = candidates || [];
  var start = findTitleStart(source, accepted);
  var end = findTitleEnd(start, accepted);
  var raw;
  var clean;

  if (end === undefined || end <= start) {
    return undefined;
  }

  raw = source.slice(start, end).split("(")[0];
  clean = cleanTitle(raw);

  if (!clean) {
    return undefined;
  }

  return {
    name: "title",
    raw: raw,
    clean: clean,
    start: start,
    end: end,
  };
};

module.exports = {
  inferTitle: inferTitle,
  cleanTitle: cleanTitle,
};
