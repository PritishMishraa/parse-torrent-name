"use strict";

var OPEN_BRACKETS = {
  "(": "round",
  "[": "square",
  "{": "curly",
};

var CLOSE_BRACKETS = {
  ")": "round",
  "]": "square",
  "}": "curly",
};

var isSeparator = function (char) {
  return /[\s._/-]/.test(char);
};

var normalizeToken = function (value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

var createToken = function (input, raw, start, end, bracket) {
  return {
    raw: raw,
    normalized: normalizeToken(raw),
    start: start,
    end: end,
    separatorBefore: input.slice(0, start).match(/[\s._/-]*$/)[0],
    separatorAfter: input.slice(end).match(/^[\s._/-]*/)[0],
    bracket: bracket,
  };
};

var tokenize = function (input) {
  var source = String(input || "");
  var tokens = [];
  var bracketStack = [];
  var tokenStart = null;
  var index;
  var char;

  var pushToken = function (end) {
    var bracket;

    if (tokenStart === null || tokenStart === end) {
      tokenStart = null;
      return;
    }

    bracket = bracketStack.length
      ? bracketStack[bracketStack.length - 1].type
      : undefined;

    tokens.push(
      createToken(source, source.slice(tokenStart, end), tokenStart, end, bracket),
    );
    tokenStart = null;
  };

  for (index = 0; index < source.length; index += 1) {
    char = source[index];

    if (OPEN_BRACKETS[char]) {
      pushToken(index);
      bracketStack.push({ char: char, type: OPEN_BRACKETS[char] });
      continue;
    }

    if (CLOSE_BRACKETS[char]) {
      pushToken(index);

      if (
        bracketStack.length &&
        bracketStack[bracketStack.length - 1].type === CLOSE_BRACKETS[char]
      ) {
        bracketStack.pop();
      }

      continue;
    }

    if (isSeparator(char)) {
      pushToken(index);
      continue;
    }

    if (tokenStart === null) {
      tokenStart = index;
    }
  }

  pushToken(source.length);

  return tokens;
};

var compareSpans = function (left, right) {
  if (left.start !== right.start) {
    return left.start - right.start;
  }

  return left.end - right.end;
};

var overlaps = function (left, right) {
  return left.start < right.end && right.start < left.end;
};

var mergeSpans = function (spans) {
  var sorted = spans.slice().sort(compareSpans);
  var merged = [];

  sorted.forEach(function (span) {
    var previous = merged[merged.length - 1];

    if (!previous || span.start > previous.end) {
      merged.push({ start: span.start, end: span.end });
      return;
    }

    if (span.end > previous.end) {
      previous.end = span.end;
    }
  });

  return merged;
};

module.exports = {
  tokenize: tokenize,
  overlaps: overlaps,
  mergeSpans: mergeSpans,
};
