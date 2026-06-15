"use strict";

var tokenizer = require("./tokenizer");

var PRIORITY = {
  STRUCTURAL: 100,
  TECHNICAL: 80,
  DESCRIPTIVE: 60,
};

var createContext = function (input, options, includeTokens) {
  var source = String(input || "");

  return {
    input: source,
    tokens: includeTokens === false ? [] : tokenizer.tokenize(source),
    options: options || {},
  };
};

var createCandidate = function (rule, raw, value, start, end, options) {
  options = options || {};

  return {
    field: options.field || rule.field,
    raw: raw,
    value: value,
    start: start,
    end: end,
    priority: rule.priority,
    confidence: options.confidence || 1,
    source: rule.id,
    consumes: options.consumes !== false,
  };
};

var compareCandidates = function (left, right) {
  if (left.start !== right.start) {
    return left.start - right.start;
  }

  if (left.end !== right.end) {
    return right.end - left.end;
  }

  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  return left.source < right.source ? -1 : left.source > right.source ? 1 : 0;
};

var forEachMatch = function (input, pattern, callback) {
  var flags = pattern.flags.indexOf("g") === -1 ? pattern.flags + "g" : pattern.flags;
  var regex = new RegExp(pattern.source, flags);
  var match;

  while ((match = regex.exec(input)) !== null) {
    callback(match);

    if (match[0] === "") {
      regex.lastIndex += 1;
    }
  }
};

var getCaptureSpan = function (match, captureIndex) {
  var raw = match[captureIndex];
  var offset;

  if (raw === undefined) {
    return {
      raw: match[0],
      start: match.index,
      end: match.index + match[0].length,
    };
  }

  offset = match[0].indexOf(raw);

  return {
    raw: raw,
    start: match.index + offset,
    end: match.index + offset + raw.length,
  };
};

var regexpRule = function (id, field, priority, pattern, options) {
  options = options || {};

  return {
    id: id,
    field: field,
    priority: priority,
    match: function (ctx) {
      var candidates = [];

      forEachMatch(ctx.input, pattern, function (match) {
        var captureIndex = Object.prototype.hasOwnProperty.call(options, "rawIndex")
          ? options.rawIndex
          : 0;
        var valueIndex = Object.prototype.hasOwnProperty.call(options, "valueIndex")
          ? options.valueIndex
          : captureIndex;
        var span = getCaptureSpan(match, captureIndex);
        var value = options.value;

        if (typeof options.skip === "function" && options.skip(match, ctx, span)) {
          return;
        }

        if (typeof value === "function") {
          value = value(match);
        } else if (value === undefined) {
          value = match[valueIndex];
        }

        candidates.push(createCandidate(this, span.raw, value, span.start, span.end));
      }.bind(this));

      return candidates;
    },
  };
};

var seasonEpisodeRule = {
  id: "episode.sxxexx",
  field: "seasonEpisode",
  priority: PRIORITY.STRUCTURAL,
  match: function (ctx) {
    var candidates = [];

    forEachMatch(ctx.input, /\bS([0-9]{1,2})E([0-9]{2,5})\b/i, function (match) {
      candidates.push(
        createCandidate(this, match[0], parseInt(match[1], 10), match.index, match.index + match[0].length, {
          field: "season",
        }),
      );

      candidates.push(
        createCandidate(this, match[0], parseInt(match[2], 10), match.index, match.index + match[0].length, {
          field: "episode",
        }),
      );
    }.bind(this));

    forEachMatch(ctx.input, /\b([0-9]{1,2})x([0-9]{1,5})\b/i, function (match) {
      candidates.push(
        createCandidate(this, match[0], parseInt(match[1], 10), match.index, match.index + match[0].length, {
          field: "season",
        }),
      );

      candidates.push(
        createCandidate(this, match[0], parseInt(match[2], 10), match.index, match.index + match[0].length, {
          field: "episode",
        }),
      );
    }.bind(this));

    forEachMatch(
      ctx.input,
      /\b(?:Saison|Season)[. _-]?([0-9]{1,2})[. _-]?(?:Ep(?:isode)?|E)[. _-]?([0-9]{1,5})\b/i,
      function (match) {
        candidates.push(
          createCandidate(this, match[0], parseInt(match[1], 10), match.index, match.index + match[0].length, {
            field: "season",
          }),
        );

        candidates.push(
          createCandidate(this, match[0], parseInt(match[2], 10), match.index, match.index + match[0].length, {
            field: "episode",
          }),
        );
      }.bind(this),
    );

    return candidates;
  },
};

var valueMapRule = function (id, field, priority, pattern, values) {
  return regexpRule(id, field, priority, pattern, {
    value: function (match) {
      var normalized = match[0].replace(/[\s._-]/g, "").toLowerCase();

      return values[normalized] || match[0];
    },
  });
};

var rules = [
  regexpRule("website.prefix", "website", PRIORITY.STRUCTURAL, /^\[\s*([^\]]+?)\s*\]/, {
    rawIndex: 0,
    valueIndex: 1,
  }),
  seasonEpisodeRule,
  regexpRule(
    "year.bounded",
    "year",
    PRIORITY.TECHNICAL,
    /(^|[^A-Za-z0-9])([\[(]?((?:19[0-9]|20[0-3])[0-9])[\])]?)($|[^A-Za-z0-9])/,
    {
      rawIndex: 2,
      value: function (match) {
        return parseInt(match[3], 10);
      },
    },
  ),
  regexpRule("resolution.standard", "resolution", PRIORITY.TECHNICAL, /(^|[^A-Za-z0-9])([0-9]{3,4}[pi])($|[^A-Za-z0-9])/i, {
    rawIndex: 2,
    value: function (match) {
      return match[2].toLowerCase();
    },
  }),
  regexpRule("resolution.alias", "resolution", PRIORITY.TECHNICAL, /\b(4K|UHD|FHD)\b/i, {
    value: function (match) {
      return /fhd/i.test(match[1]) ? "1080p" : "4k";
    },
  }),
  valueMapRule("source.standard", "source", PRIORITY.TECHNICAL, /\b(?:(?:PPV\.)?HDTV|WEB-?DL|WEB-?Rip|PDTV|Blu-?Ray|BRRip|BDRip|HD-?Rip|DVD(?:Rip|scr)?|REMUX|HD-?CAM|CamRip|TS|Telesync)\b/i, {
    bluray: "bluray",
    brrip: "bluray",
    bdrip: "bluray",
    camrip: "cam",
    dvdrip: "dvd",
    dvdscr: "dvd",
    dvd: "dvd",
    hdcam: "cam",
    hdrip: "hdrip",
    hdtv: "hdtv",
    pdtv: "hdtv",
    ppvhdtv: "hdtv",
    remux: "remux",
    telesync: "telesync",
    ts: "telesync",
    webdl: "web-dl",
    webrip: "webrip",
  }),
  valueMapRule("codec.standard", "codec", PRIORITY.TECHNICAL, /\b(?:xvid|x264|x[-. ]?265|h[-. ]?264|h[-. ]?265|hevc|av1)\b/i, {
    av1: "AV1",
    h264: "H264",
    h265: "HEVC",
    hevc: "HEVC",
    x264: "x264",
    x265: "HEVC",
    xvid: "XviD",
  }),
  valueMapRule("audio.standard", "audio", PRIORITY.TECHNICAL, /\b(?:DTS[-. ]?HD(?:[-. ]?MA)?|TrueHD|DDP(?:[. ]?[0-9][. ][0-9])?|DD\+|EAC-?3|AAC(?:\.?2\.0)?|AC3(?:\.5\.1)?|FLAC|Opus|MP3)\b/i, {
    aac: "AAC",
    aac20: "AAC2.0",
    ac3: "AC3",
    ac351: "AC3.5.1",
    ddp: "DDP",
    ddp20: "DDP",
    ddp51: "DDP",
    ddp71: "DDP",
    "dd+": "DDP",
    dts: "DTS",
    dtshd: "DTS-HD",
    dtshdma: "DTS-HD MA",
    eac3: "DDP",
    flac: "FLAC",
    mp3: "MP3",
    opus: "Opus",
    truehd: "TrueHD",
  }),
  regexpRule("channels.standard", "channels", PRIORITY.TECHNICAL, /\b(?:([257])\.([01])|([268])ch)\b/i, {
    value: function (match) {
      if (match[3] === "2") {
        return "2.0";
      }

      if (match[3] === "6") {
        return "5.1";
      }

      if (match[3] === "8") {
        return "7.1";
      }

      return match[1] + "." + match[2];
    },
  }),
  regexpRule("channels.embedded-audio", "channels", PRIORITY.TECHNICAL, /\b(?:DDP|DD|AAC|AC3)([257]\.[01])\b/i, {
    rawIndex: 1,
    valueIndex: 1,
  }),
  regexpRule("atmos.standard", "atmos", PRIORITY.TECHNICAL, /\bAtmos\b/i, {
    value: true,
  }),
  valueMapRule("color.standard", "colors", PRIORITY.TECHNICAL, /(?:\bHDR10\+|\bHDR10\b|\bHDR\b|\bDV\b|\bDoVi\b|\bDolby[. ]Vision\b|\bSDR\b)/i, {
    dolbyvision: "DV",
    dovi: "DV",
    dv: "DV",
    hdr: "HDR",
    hdr10: "HDR10",
    "hdr10+": "HDR10+",
    sdr: "SDR",
  }),
  regexpRule("bitdepth.standard", "bitdepth", PRIORITY.TECHNICAL, /\b(8|10|12|16|24)[-\s.]?bits?\b/i, {
    value: function (match) {
      return parseInt(match[1], 10);
    },
  }),
  regexpRule("samplerate.standard", "samplerate", PRIORITY.TECHNICAL, /\b((?:\d+)(?:\.\d+)?)[-\s.]?kHz?\b/i, {
    value: function (match) {
      return parseFloat(match[1]);
    },
  }),
  valueMapRule("service.standard", "service", PRIORITY.TECHNICAL, /\b(?:AMZN|Amazon|ATVP|AppleTV|DSNP|Disney\+?|HMAX|HBO[. ]Max|HULU|NF|NFLX|Netflix|PCOK|Peacock)\b/i, {
    amazon: "AMZN",
    amzn: "AMZN",
    appletv: "ATVP",
    atvp: "ATVP",
    disney: "DSNP",
    "disney+": "DSNP",
    dsnp: "DSNP",
    hbomax: "HMAX",
    hmax: "HMAX",
    hulu: "HULU",
    max: "HMAX",
    netflix: "NFLX",
    nf: "NFLX",
    nflx: "NFLX",
    pcok: "PCOK",
    peacock: "PCOK",
  }),
  valueMapRule("language.standard", "language", PRIORITY.DESCRIPTIVE, /\b(?:rus\.eng|MULTi(?:Lang|-audio|-VF2)?|Dual(?:[- ]Audio)?|ENGLISH|ENG|FR(?:ENCH)?|TRUEFRENCH|VFF|VFI|ITA(?:LIAN)?|GERMAN|RUS|UKR|JPN|NORDIC|DUBBED)\b/i, {
    dual: "dual",
    dualaudio: "dual",
    dubbed: "dubbed",
    eng: "eng",
    english: "eng",
    fr: "fr",
    french: "fr",
    german: "german",
    ita: "ita",
    italian: "ita",
    jpn: "jpn",
    multi: "multi",
    multiaudio: "multi",
    multilang: "multi",
    multivf2: "multi",
    nordic: "nordic",
    rus: "rus",
    ruseng: "rus.eng",
    "rus.eng": "rus.eng",
    truefrench: "fr",
    ukr: "ukr",
    vff: "fr",
    vfi: "fr",
  }),
  valueMapRule("flag.release", "flags", PRIORITY.DESCRIPTIVE, /\b(?:EXTENDED|THEATRICAL|UNCUT|UNRATED|UNCENSORED|OPEN[. ]MATTE|HYBRID|REMUX|HC|HARDCODED|REAL[. ]PROPER|PROPER|REPACK|RERIP|INTERNAL|RETAIL|REMASTERED?|WS)\b/i, {
    extended: "extended",
    hc: "hardcoded",
    hardcoded: "hardcoded",
    hybrid: "hybrid",
    internal: "internal",
    openmatte: "openmatte",
    proper: "proper",
    remastered: "remastered",
    remaster: "remastered",
    remux: "remux",
    repack: "repack",
    rerip: "repack",
    retail: "retail",
    realproper: "proper",
    theatrical: "theatrical",
    uncut: "uncut",
    uncensored: "unrated",
    unrated: "unrated",
    ws: "widescreen",
  }),
  valueMapRule("container.standard", "container", PRIORITY.DESCRIPTIVE, /\b(?:MKV|AVI|MP4)\b/i, {
    avi: "AVI",
    mkv: "MKV",
    mp4: "MP4",
  }),
  regexpRule("region.standard", "region", PRIORITY.DESCRIPTIVE, /(?:^|[\W_])(R[0-9])(?:$|[\W_])/, {
    rawIndex: 1,
    valueIndex: 1,
  }),
  regexpRule("garbage.legacy", "garbage", PRIORITY.DESCRIPTIVE, /\b(?:1400Mb|3rd Nov|Rip)\b/i),
  regexpRule("encoder.before-final-group", "encoder", PRIORITY.DESCRIPTIVE, /-([A-Za-z0-9][A-Za-z0-9[\]{}=+ ]*)-([A-Za-z0-9][A-Za-z0-9[\]{}=+ ]*)$/, {
    rawIndex: 1,
    valueIndex: 1,
  }),
  regexpRule("group.final-hyphen", "group", PRIORITY.STRUCTURAL, /-\s*([A-Za-z0-9][A-Za-z0-9[\]{}=+ ]*)$/, {
    rawIndex: 0,
    valueIndex: 1,
  }),
];

var TITLE_RULE_IDS = {
  "episode.sxxexx": true,
  "garbage.legacy": true,
  "region.standard": true,
  "resolution.alias": true,
  "resolution.standard": true,
  "source.standard": true,
  "website.prefix": true,
  "year.bounded": true,
};

var EPISODE_NAME_RULE_IDS = {
  "atmos.standard": true,
  "audio.standard": true,
  "bitdepth.standard": true,
  "channels.embedded-audio": true,
  "channels.standard": true,
  "codec.standard": true,
  "color.standard": true,
  "container.standard": true,
  "encoder.before-final-group": true,
  "episode.sxxexx": true,
  "flag.release": true,
  "garbage.legacy": true,
  "group.final-hyphen": true,
  "language.standard": true,
  "region.standard": true,
  "resolution.alias": true,
  "resolution.standard": true,
  "samplerate.standard": true,
  "service.standard": true,
  "source.standard": true,
  "year.bounded": true,
};

var GROUP_RULE_IDS = {
  "encoder.before-final-group": true,
  "group.final-hyphen": true,
};

var titleRules = rules.filter(function (rule) {
  return TITLE_RULE_IDS[rule.id];
});

var episodeNameRules = rules.filter(function (rule) {
  return EPISODE_NAME_RULE_IDS[rule.id];
});

var groupRules = rules.filter(function (rule) {
  return GROUP_RULE_IDS[rule.id];
});

var collectCandidates = function (input, options, ruleList, includeTokens) {
  var ctx = createContext(input, options, includeTokens);
  var candidates = [];

  ruleList.forEach(function (rule) {
    candidates = candidates.concat(rule.match(ctx));
  });

  return candidates.sort(compareCandidates);
};

var extractCandidates = function (input, options) {
  return collectCandidates(input, options, rules);
};

var extractTitleCandidates = function (input, options) {
  return collectCandidates(input, options, titleRules, false);
};

var extractEpisodeNameCandidates = function (input, options) {
  return collectCandidates(input, options, episodeNameRules, false);
};

var extractGroupCandidates = function (input, options) {
  return collectCandidates(input, options, groupRules, false);
};

module.exports = {
  PRIORITY: PRIORITY,
  createContext: createContext,
  createCandidate: createCandidate,
  extractEpisodeNameCandidates: extractEpisodeNameCandidates,
  extractCandidates: extractCandidates,
  extractGroupCandidates: extractGroupCandidates,
  extractTitleCandidates: extractTitleCandidates,
  rules: rules,
};
