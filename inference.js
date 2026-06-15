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

var EPISODE_NAME_BOUNDARY_FIELDS = {
  atmos: true,
  audio: true,
  bitdepth: true,
  channels: true,
  codec: true,
  colors: true,
  container: true,
  encoder: true,
  flags: true,
  garbage: true,
  group: true,
  language: true,
  region: true,
  resolution: true,
  samplerate: true,
  service: true,
  source: true,
  year: true,
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

var cleanPhrase = function (raw) {
  return String(raw || "")
    .replace(/^[\s._-]+/, "")
    .replace(/[\s._-]+$/, "")
    .replace(/[\._]/g, " ")
    .trim();
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

var getEpisodeCandidate = function (candidates) {
  return (candidates || []).find(function (candidate) {
    return candidate.field === "episode";
  });
};

var findEpisodeNameEnd = function (start, input, candidates) {
  var end;

  (candidates || []).forEach(function (candidate) {
    if (candidate.field === "group" && /\s/.test(String(candidate.value || ""))) {
      return;
    }

    if (
      !EPISODE_NAME_BOUNDARY_FIELDS[candidate.field] ||
      candidate.start < start
    ) {
      return;
    }

    if (end === undefined || candidate.start < end) {
      end = candidate.start;
    }
  });

  return end === undefined ? String(input || "").length : end;
};

var inferEpisodeName = function (input, candidates) {
  var source = String(input || "");
  var episode = getEpisodeCandidate(candidates);
  var start;
  var end;
  var raw;
  var clean;

  if (!episode) {
    return undefined;
  }

  start = episode.end;
  end = findEpisodeNameEnd(start, source, candidates);

  if (end <= start) {
    return undefined;
  }

  raw = source.slice(start, end);
  clean = cleanPhrase(raw);

  if (!clean) {
    return undefined;
  }

  return {
    name: "episodeName",
    raw: raw,
    clean: clean,
    start: start,
    end: end,
  };
};

module.exports = {
  inferEpisodeName: inferEpisodeName,
  inferTitle: inferTitle,
  cleanPhrase: cleanPhrase,
  cleanTitle: cleanTitle,
};
