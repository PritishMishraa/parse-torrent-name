"use strict";

var candidateExtractors = require("./candidate-extractors");
var inference = require("./inference");
var resolver = require("./resolver");

var rules = [
  { name: "season", pattern: /([Ss]?([0-9]{1,2}))[Eex]/, type: "integer" },
  {
    name: "season",
    pattern: /[0-9]{1,2}x[0-9]{1,5}/,
    clean: function (match) {
      return parseInt(match[0].split("x")[0], 10);
    },
    skipIfFound: true,
  },
  {
    name: "season",
    pattern: /(?:Saison|Season)[. _-]?([0-9]{1,2})/i,
    rawIndex: 0,
    cleanIndex: 1,
    type: "integer",
    skipIfFound: true,
  },
  {
    name: "season",
    pattern: /\bS([0-9]{1,2})(?![0-9])/i,
    rawIndex: 0,
    cleanIndex: 1,
    type: "integer",
    skipIfFound: true,
  },
  {
    name: "episode",
    pattern: /([Eex]([0-9]{2})(?:[^0-9]|$))/,
    type: "integer",
  },
  {
    name: "episode",
    pattern: /[0-9]{1,2}x[0-9]{1,5}/,
    clean: function (match) {
      return parseInt(match[0].split("x")[1], 10);
    },
    skipIfFound: true,
  },
  {
    name: "episode",
    pattern: /[ée]p(?:isode)?[. _-]?([0-9]{1,5})/i,
    rawIndex: 0,
    cleanIndex: 1,
    type: "integer",
    skipIfFound: true,
  },
  {
    name: "year",
    pattern: /([\[\(]?((?:19[0-9]|20[0-3])[0-9])[\]\)]?)/,
    type: "integer",
  },
  { name: "resolution", pattern: /(([0-9]{3,4}[pi]))(?:$|[\W_])/i },
  {
    name: "resolution",
    pattern: /\b(?:4K|UHD)\b/i,
    value: "4k",
    skipIfFound: true,
  },
  {
    name: "resolution",
    pattern: /\b(?:FHD|1080)\b/i,
    value: "1080p",
    skipIfFound: true,
  },
  {
    name: "quality",
    pattern:
      /(?:PPV\.)?[HP]DTV|(?:HD)?CAM|B[rR]Rip|TS|(?:PPV )?WEB-?DL(?: DVDRip)?|H[dD]Rip|DVDRip|DVDRiP|DVDRIP|CamRip|W[EB]B[rR]ip|[Bb]lu[Rr]ay|DvDScr|hdtv/,
  },
  { name: "source", pattern: /\b(?:HD-?)?CAM\b/i, value: "cam" },
  {
    name: "source",
    pattern: /\b(?:HD-?)?T(?:ELE)?S(?:YNC)?\b/i,
    value: "telesync",
    skipIfFound: true,
  },
  {
    name: "source",
    pattern: /\b(?:PPV\.)?HDTV\b/i,
    value: "hdtv",
    skipIfFound: true,
  },
  {
    name: "source",
    pattern: /\bWEB-?DL\b/i,
    value: "web-dl",
    skipIfFound: true,
  },
  {
    name: "source",
    pattern: /\bWEB-?Rip\b/i,
    value: "webrip",
    skipIfFound: true,
  },
  {
    name: "source",
    pattern: /\bBlu-?Ray\b|\bBRRip\b|\bBDRip\b/i,
    value: "bluray",
    skipIfFound: true,
  },
  {
    name: "source",
    pattern: /\bDVD(?:Rip|scr)?\b/i,
    value: "dvd",
    skipIfFound: true,
  },
  { name: "source", pattern: /\bREMUX\b/i, value: "remux", skipIfFound: true },
  { name: "codec", pattern: /xvid|x264|h\.?264/i },
  {
    name: "codec",
    pattern: /\b(?:h[-. ]?265|hevc|x[-. ]?265)\b/i,
    value: "HEVC",
    skipIfFound: true,
  },
  { name: "codec", pattern: /\b(?:av1)\b/i, value: "AV1", skipIfFound: true },
  {
    name: "audio",
    pattern:
      /MP3|DD5\.?1|Dual[\- ]Audio|LiNE|DTS|AAC(?:\.?2\.0)?|AC3(?:\.5\.1)?/,
  },
  {
    name: "audio",
    pattern: /\b(?:DDP|DD\+|EAC-?3)(?:[. ]?[0-9][. ][0-9])?\b/i,
    value: "DDP",
    skipIfFound: true,
  },
  { name: "audio", pattern: /\bTrueHD\b/i, value: "TrueHD", skipIfFound: true },
  { name: "audio", pattern: /\bFLAC\b/i, value: "FLAC", skipIfFound: true },
  { name: "audio", pattern: /\bOpus\b/i, value: "Opus", skipIfFound: true },
  { name: "atmos", pattern: /\bAtmos\b/i, type: "boolean" },
  {
    name: "channels",
    pattern: /\b([0-9])[. ]([01])\b/,
    rawIndex: 0,
    clean: function (match) {
      return match[1] + "." + match[2];
    },
  },
  { name: "channels", pattern: /\b2ch\b/i, value: "2.0", skipIfFound: true },
  { name: "channels", pattern: /\b6ch\b/i, value: "5.1", skipIfFound: true },
  { name: "channels", pattern: /\b8ch\b/i, value: "7.1", skipIfFound: true },
  {
    name: "bitdepth",
    pattern: /\b(8|10|12|16|24)[-\s.]?bits?\b/i,
    rawIndex: 0,
    cleanIndex: 1,
    type: "integer",
  },
  {
    name: "samplerate",
    pattern: /\b((?:\d+)(?:\.\d+)?)[-\s.]?kHz?\b/i,
    rawIndex: 0,
    cleanIndex: 1,
    type: "float",
  },
  {
    name: "color",
    pattern: /\bHDR10\+\b/i,
    value: "HDR10+",
    appendTo: "colors",
    preserve: true,
  },
  {
    name: "color",
    pattern: /\bHDR10\b/i,
    value: "HDR10",
    appendTo: "colors",
    preserve: true,
  },
  {
    name: "color",
    pattern: /\bHDR\b/i,
    value: "HDR",
    appendTo: "colors",
    preserve: true,
  },
  {
    name: "color",
    pattern: /\b(?:DV|DoVi|Dolby[. ]Vision)\b/i,
    value: "DV",
    appendTo: "colors",
    preserve: true,
  },
  {
    name: "color",
    pattern: /\bSDR\b/i,
    value: "SDR",
    appendTo: "colors",
    preserve: true,
  },
  { name: "service", pattern: /\b(?:AMZN|Amazon)\b/i, value: "AMZN" },
  {
    name: "service",
    pattern: /\b(?:ATVP|AppleTV)\b/i,
    value: "ATVP",
    skipIfFound: true,
  },
  {
    name: "service",
    pattern: /\b(?:DSNP|Disney\+?)\b/i,
    value: "DSNP",
    skipIfFound: true,
  },
  {
    name: "service",
    pattern: /\b(?:HMAX|HBO[. ]Max|Max)\b/i,
    value: "HMAX",
    skipIfFound: true,
  },
  {
    name: "service",
    pattern: /\b(?:HULU)\b/i,
    value: "HULU",
    skipIfFound: true,
  },
  {
    name: "service",
    pattern: /\b(?:NF|NFLX|Netflix)\b/i,
    value: "NFLX",
    skipIfFound: true,
  },
  {
    name: "service",
    pattern: /\b(?:PCOK|Peacock)\b/i,
    value: "PCOK",
    skipIfFound: true,
  },
  { name: "group", pattern: /(- ?([^-]+(?:-={[^-]+-?$)?))$/ },
  {
    name: "region",
    pattern: /(?:^|[\W_])(R[0-9])(?:$|[\W_])/,
    rawIndex: 1,
    cleanIndex: 1,
  },
  { name: "extended", pattern: /EXTENDED(?:[\s.]CUT)?/i, type: "boolean" },
  { name: "theatrical", pattern: /Theatrical(?:[. ]Cut)?/i, type: "boolean" },
  { name: "uncut", pattern: /\bUNCUT\b/i, type: "boolean" },
  { name: "unrated", pattern: /\b(?:UNRATED|UNCENSORED)\b/i, type: "boolean" },
  { name: "openmatte", pattern: /OPEN[. ]MATTE/i, type: "boolean" },
  { name: "hybrid", pattern: /\bHYBRID\b/i, type: "boolean" },
  { name: "remux", pattern: /\bREMUX\b/i, type: "boolean" },
  { name: "hardcoded", pattern: /\b(?:HC|HARDCODED)\b/i, type: "boolean" },
  { name: "proper", pattern: /\b(?:REAL.)?PROPER\b/i, type: "boolean" },
  { name: "repack", pattern: /\b(?:REPACK|RERIP)\b/i, type: "boolean" },
  { name: "internal", pattern: /\bINTERNAL\b/i, type: "boolean" },
  { name: "retail", pattern: /\bRetail\b/i, type: "boolean" },
  { name: "remastered", pattern: /\bRemaster(?:ed)?\b/i, type: "boolean" },
  {
    name: "container",
    pattern: /\b(MKV|AVI|MP4)\b/i,
    rawIndex: 0,
    cleanIndex: 1,
  },
  { name: "widescreen", pattern: /WS/, type: "boolean" },
  { name: "website", pattern: /^(\[ ?([^\]]+?) ?\])/ },
  { name: "language", pattern: /rus\.eng/ },
  {
    name: "language",
    pattern: /\bMULTi(?:Lang|-audio|-VF2)?\b/i,
    value: "multi",
    skipIfFound: true,
  },
  {
    name: "language",
    pattern: /Dual(?:[- ]Audio)?|[ .]DL[ .]/i,
    value: "dual",
    skipIfFound: true,
  },
  {
    name: "language",
    pattern: /\bENGLISH\b/i,
    value: "eng",
    skipIfFound: true,
  },
  {
    name: "language",
    pattern: /\b(?:FR(?:ENCH)?|TRUEFRENCH|VFF|VFI)\b/i,
    value: "fr",
    skipIfFound: true,
  },
  {
    name: "language",
    pattern: /\b(?:ITA(?:LIAN)?|iTA(?:LiAN)?)\b/,
    value: "ita",
    skipIfFound: true,
  },
  {
    name: "language",
    pattern: /\b(?:GERMAN|RUS|UKR|JPN|NORDIC|DUBBED)\b/i,
    type: "lowercase",
    skipIfFound: true,
  },
  { name: "garbage", pattern: /1400Mb|3rd Nov| ((Rip))/ },
];

var patterns = {
  codec: /xvid|x264|h\.?264/i,
  quality:
    /(?:PPV\.)?[HP]DTV|(?:HD)?CAM|B[rR]Rip|TS|(?:PPV )?WEB-?DL(?: DVDRip)?|H[dD]Rip|DVDRip|DVDRiP|DVDRIP|CamRip|W[EB]B[rR]ip|[Bb]lu[Rr]ay|DvDScr|hdtv/,
};

var escapeRegex = function (string) {
  return string.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
};

var getClean = function (rule, match, cleanIndex) {
  var clean;

  if (Object.prototype.hasOwnProperty.call(rule, "value")) {
    return rule.value;
  }

  if (rule.clean) {
    return rule.clean(match);
  }

  if (rule.type === "boolean") {
    return true;
  }

  clean = match[cleanIndex];

  if (rule.type === "integer") {
    clean = parseInt(clean, 10);
  } else if (rule.type === "float") {
    clean = parseFloat(clean);
  } else if (rule.type === "lowercase") {
    clean = clean.toLowerCase();
  } else if (rule.type === "uppercase") {
    clean = clean.toUpperCase();
  }

  return clean;
};

var getTitle = function (name, start, end) {
  var raw = end ? name.substr(start, end - start).split("(")[0] : name;
  var clean = raw.replace(/^ -/, "");

  if (clean.indexOf(" ") === -1 && clean.indexOf(".") !== -1) {
    clean = clean.replace(/\./g, " ");
  }

  clean = clean.replace(/_/g, " ");
  clean = clean.replace(/([\(_]|- )$/, "").trim();

  return {
    name: "title",
    raw: raw,
    clean: clean,
  };
};

var uniquePush = function (array, value) {
  if (value && array.indexOf(value) === -1) {
    array.push(value);
  }
};

var normalizeToken = function (value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
};

var normalizeTitle = function (value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
};

var normalizeResolution = function (value) {
  var token = normalizeToken(value);
  var pixels;

  if (!token) {
    return undefined;
  }

  if (
    token === "4k" ||
    token === "uhd" ||
    token === "2160p" ||
    token === "2160"
  ) {
    return "uhd";
  }

  if (token === "fhd" || token === "1080p" || token === "1080") {
    return "fhd";
  }

  pixels = parseInt(token, 10);

  if (!pixels) {
    return undefined;
  }

  if (pixels >= 2000) {
    return "uhd";
  }

  if (pixels >= 1080) {
    return "fhd";
  }

  if (pixels >= 720) {
    return "hd";
  }

  return "sd";
};

var normalizeSource = function (value) {
  var token = normalizeToken(value);

  if (!token) {
    return undefined;
  }

  if (token === "webdl" || token === "web") {
    return "webdl";
  }

  if (token === "webrip") {
    return "webrip";
  }

  if (token === "bluray" || token === "brrip" || token === "bdrip") {
    return "bluray";
  }

  if (token === "remux") {
    return "remux";
  }

  if (token === "hdtv" || token === "pdtv" || token === "tvrip") {
    return "hdtv";
  }

  if (token === "dvd" || token === "dvdrip" || token === "dvdscr") {
    return "dvd";
  }

  if (token === "cam" || token === "hdcam" || token === "camrip") {
    return "cam";
  }

  if (token === "ts" || token === "telesync") {
    return "telesync";
  }

  if (token === "hdrip") {
    return "hdrip";
  }

  return token;
};

var normalizeCodec = function (value) {
  var token = normalizeToken(value);

  if (!token) {
    return undefined;
  }

  if (token === "h264" || token === "x264" || token === "avc") {
    return "h264";
  }

  if (token === "h265" || token === "x265" || token === "hevc") {
    return "hevc";
  }

  if (token === "av1") {
    return "av1";
  }

  if (token === "xvid" || token === "divx") {
    return "xvid";
  }

  return token;
};

var normalizeAudio = function (value) {
  var token = normalizeToken(value);

  if (!token) {
    return undefined;
  }

  if (token === "ddp" || token === "ddplus" || token === "eac3") {
    return "ddp";
  }

  if (
    token === "dd" ||
    token === "dd51" ||
    token === "ac3" ||
    token === "ac351"
  ) {
    return "ac3";
  }

  if (token === "truehd") {
    return "truehd";
  }

  if (token === "dts" || token === "dtshd" || token === "dtshdma") {
    return token === "dts" ? "dts" : "dts_hd";
  }

  if (token === "aac") {
    return "aac";
  }

  if (token === "flac") {
    return "flac";
  }

  if (token === "mp3") {
    return "mp3";
  }

  if (token === "opus") {
    return "opus";
  }

  if (token === "dualaudio" || token === "dual") {
    return "dual_audio";
  }

  if (token === "line") {
    return "line";
  }

  return token;
};

var normalizeColor = function (value) {
  var token = normalizeToken(value);

  if (!token) {
    return undefined;
  }

  if (token === "dv" || token === "dovi" || token === "dolbyvision") {
    return "dolby_vision";
  }

  if (token === "hdr10") {
    return "hdr10";
  }

  if (token === "hdr10plus") {
    return "hdr10plus";
  }

  if (token === "hdr") {
    return "hdr";
  }

  if (token === "sdr") {
    return "sdr";
  }

  return token;
};

var normalizeService = function (value) {
  var token = normalizeToken(value);

  if (!token) {
    return undefined;
  }

  if (token === "amzn" || token === "amazon") {
    return "amazon";
  }

  if (token === "atvp" || token === "appletv") {
    return "apple_tv";
  }

  if (token === "dsnp" || token === "disney") {
    return "disney_plus";
  }

  if (token === "hmax" || token === "hbomax" || token === "max") {
    return "max";
  }

  if (token === "hulu") {
    return "hulu";
  }

  if (token === "nf" || token === "nflx" || token === "netflix") {
    return "netflix";
  }

  if (token === "pcok" || token === "peacock") {
    return "peacock";
  }

  return token;
};

var getReleaseType = function (source) {
  if (source === "webdl" || source === "webrip") {
    return "web";
  }

  if (source === "bluray" || source === "remux") {
    return "disc";
  }

  if (source === "hdtv") {
    return "tv";
  }

  if (source === "cam" || source === "telesync") {
    return "cam";
  }

  if (source === "dvd") {
    return "dvd";
  }

  return source;
};

var addNormalizedArrayValue = function (target, key, value) {
  if (!value) {
    return;
  }

  if (!target[key]) {
    target[key] = [];
  }

  uniquePush(target[key], value);
};

var normalizeParts = function (parts) {
  var normalized = {};
  var source;
  var audio;
  var colors;
  var flags = [
    "extended",
    "theatrical",
    "uncut",
    "unrated",
    "openmatte",
    "hybrid",
    "remux",
    "hardcoded",
    "proper",
    "repack",
    "internal",
    "retail",
    "remastered",
    "widescreen",
  ];

  if (parts.title) {
    normalized.title = normalizeTitle(parts.title);
  }

  normalized.type = parts.season || parts.episode ? "show" : "movie";

  if (parts.resolution) {
    normalized.resolution = normalizeResolution(parts.resolution);
  }

  source = normalizeSource(parts.source || parts.quality);

  if (source) {
    normalized.source = source;
    normalized.releaseType = getReleaseType(source);
  }

  if (parts.codec) {
    normalized.codec = normalizeCodec(parts.codec);
  }

  audio = normalizeAudio(parts.audio);

  if (audio) {
    addNormalizedArrayValue(normalized, "audio", audio);
  }

  if (parts.atmos) {
    addNormalizedArrayValue(normalized, "audio", "atmos");
  }

  if (parts.channels) {
    normalized.channels = parts.channels;
  }

  colors = parts.colors || (parts.color ? [parts.color] : []);

  colors.forEach(function (color) {
    addNormalizedArrayValue(normalized, "hdr", normalizeColor(color));
  });

  if (parts.service) {
    normalized.service = normalizeService(parts.service);
  }

  flags.forEach(function (flag) {
    if (parts[flag]) {
      addNormalizedArrayValue(normalized, "flags", flag);
    }
  });

  if (parts.language) {
    addNormalizedArrayValue(
      normalized,
      "languages",
      normalizeToken(parts.language),
    );
  }

  if (parts.bitdepth) {
    normalized.bitdepth = parts.bitdepth;
  }

  if (parts.samplerate) {
    normalized.samplerate = parts.samplerate;
  }

  if (parts.container) {
    normalized.container = normalizeToken(parts.container);
  }

  return normalized;
};

module.exports.exec = function (name, options) {
  var parts = {};
  var start = 0;
  var end;
  var groupRaw = "";
  var map;
  var consumedSpans = [];
  var resolvedCandidates;
  var resolvedEpisodeNameCandidates;
  var resolvedGroupCandidates;
  var inferredTitle;
  var inferredEpisodeName;
  var inferredGroupAndEncoder;
  options = options || {};

  resolvedCandidates = resolver.resolveCandidates(
    name,
    candidateExtractors.extractTitleCandidates(name, options),
  );

  if (
    resolvedCandidates.accepted.some(function (candidate) {
      return candidate.field === "episode";
    })
  ) {
    resolvedEpisodeNameCandidates = resolver.resolveCandidates(
      name,
      candidateExtractors.extractEpisodeNameCandidates(name, options),
    );
  }

  resolvedGroupCandidates = resolver.resolveCandidates(
    name,
    candidateExtractors.extractGroupCandidates(name, options),
  );

  var addConsumedSpan = function (part) {
    var rawOffset;
    var spanStart;

    if (!part.raw) {
      return;
    }

    if (typeof part.start === "number") {
      consumedSpans.push({
        start: part.start,
        end: part.start + part.raw.length,
      });
      return;
    }

    if (!part.match || typeof part.match.index !== "number") {
      return;
    }

    rawOffset = part.match[0].indexOf(part.raw);

    if (rawOffset === -1) {
      return;
    }

    spanStart = part.match.index + rawOffset;
    consumedSpans.push({
      start: spanStart,
      end: spanStart + part.raw.length,
    });
  };

  var addPart = function (part) {
    if (part.appendTo) {
      if (!parts[part.appendTo]) {
        parts[part.appendTo] = [];
      }

      if (parts[part.appendTo].indexOf(part.clean) === -1) {
        parts[part.appendTo].push(part.clean);
      }
    }

    if (
      !part.preserve ||
      !Object.prototype.hasOwnProperty.call(parts, part.name)
    ) {
      parts[part.name] = part.clean;
    }

    if (part.match) {
      if (part.match.index === 0) {
        start = part.match[0].length;
      } else if (!end || part.match.index < end) {
        end = part.match.index;
      }
    }

    if (part.name === "group") {
      groupRaw = part.raw;
    }

    if (part.name !== "excess") {
      addConsumedSpan(part);
    }
  };

  rules.forEach(function (rule) {
    var match = name.match(rule.pattern);
    var rawIndex;
    var cleanIndex;
    var clean;
    var partName;
    var part;

    if (!match) {
      return;
    }

    if (
      rule.skipIfFound &&
      Object.prototype.hasOwnProperty.call(parts, rule.name)
    ) {
      return;
    }

    rawIndex = Object.prototype.hasOwnProperty.call(rule, "rawIndex")
      ? rule.rawIndex
      : match[1]
        ? 1
        : 0;
    cleanIndex = Object.prototype.hasOwnProperty.call(rule, "cleanIndex")
      ? rule.cleanIndex
      : match[1]
        ? 2
        : 0;
    clean = getClean(rule, match, cleanIndex);
    partName = rule.name;

    if (partName === "group") {
      if (clean.match(patterns.codec) || clean.match(patterns.quality)) {
        return;
      }

      if (clean.match(/[^ ]+ [^ ]+ .+/)) {
        partName = "episodeName";
      }
    }

    part = {
      name: partName,
      match: match,
      raw: match[rawIndex],
      clean: clean,
      appendTo: rule.appendTo,
      preserve: rule.preserve,
    };

    if (partName === "episode") {
      map = name.replace(part.raw, "{episode}");
    }

    addPart(part);
  });

  inferredTitle = inference.inferTitle(name, resolvedCandidates.accepted);
  addPart(inferredTitle || getTitle(name, start, end));

  if (resolvedEpisodeNameCandidates) {
    inferredEpisodeName = inference.inferEpisodeName(
      name,
      resolvedEpisodeNameCandidates.accepted,
    );

    if (inferredEpisodeName) {
      addPart(inferredEpisodeName);
    }
  }

  inferredGroupAndEncoder = inference.inferGroupAndEncoder(
    name,
    resolvedGroupCandidates.accepted,
  );

  if (inferredGroupAndEncoder.encoder) {
    addPart(inferredGroupAndEncoder.encoder);
  }

  if (inferredGroupAndEncoder.group) {
    addPart(inferredGroupAndEncoder.group);
  }

  (function addExcess() {
    var clean = inference.inferExcess(name, consumedSpans);
    var groupPattern;
    var episodeNamePattern;

    if (clean.length !== 0) {
      groupPattern = escapeRegex(clean[clean.length - 1] + groupRaw) + "$";

      if (name.match(new RegExp(groupPattern))) {
        addPart({
          name: "group",
          clean: clean.pop() + groupRaw,
        });
      }

      if (!parts.episodeName && map && clean[0]) {
        episodeNamePattern =
          "{episode}" + escapeRegex(clean[0].replace(/_+$/, ""));

        if (map.match(new RegExp(episodeNamePattern))) {
          addPart({
            name: "episodeName",
            clean: clean
              .shift()
              .replace(/[\._]/g, " ")
              .replace(/_+$/, "")
              .trim(),
          });
        }
      }
    }

    if (clean.length !== 0) {
      addPart({
        name: "excess",
        raw: "",
        clean: clean.length === 1 ? clean[0] : clean,
      });
    }
  })();

  if (options.normalize) {
    parts.normalized = normalizeParts(parts);
  }

  return parts;
};
