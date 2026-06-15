"use strict";

var tokenizer = require("./tokenizer");

var candidateLength = function (candidate) {
  return candidate.end - candidate.start;
};

var compareForAcceptance = function (left, right) {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  if (left.confidence !== right.confidence) {
    return right.confidence - left.confidence;
  }

  if (candidateLength(left) !== candidateLength(right)) {
    return candidateLength(right) - candidateLength(left);
  }

  if (left.start !== right.start) {
    return left.start - right.start;
  }

  if (left.end !== right.end) {
    return right.end - left.end;
  }

  return left.index - right.index;
};

var compareByPosition = function (left, right) {
  if (left.start !== right.start) {
    return left.start - right.start;
  }

  if (left.end !== right.end) {
    return left.end - right.end;
  }

  return left.index - right.index;
};

var canShareSpan = function (left, right) {
  return (
    left.start === right.start &&
    left.end === right.end &&
    left.field !== right.field
  );
};

var findBlockingCandidate = function (accepted, candidate) {
  var index;
  var current;

  if (candidate.consumes === false) {
    return undefined;
  }

  for (index = 0; index < accepted.length; index += 1) {
    current = accepted[index];

    if (current.consumes === false || canShareSpan(current, candidate)) {
      continue;
    }

    if (tokenizer.overlaps(current, candidate)) {
      return current;
    }
  }

  return undefined;
};

var getConsumedSpans = function (accepted) {
  return tokenizer.mergeSpans(
    accepted
      .filter(function (candidate) {
        return candidate.consumes !== false;
      })
      .map(function (candidate) {
        return {
          start: candidate.start,
          end: candidate.end,
        };
      }),
  );
};

var getUnconsumedSpans = function (input, consumedSpans) {
  var source = String(input || "");
  var spans = [];
  var cursor = 0;

  consumedSpans.forEach(function (span) {
    if (cursor < span.start) {
      spans.push({
        start: cursor,
        end: span.start,
        raw: source.slice(cursor, span.start),
      });
    }

    cursor = Math.max(cursor, span.end);
  });

  if (cursor < source.length) {
    spans.push({
      start: cursor,
      end: source.length,
      raw: source.slice(cursor),
    });
  }

  return spans;
};

var resolveCandidates = function (input, candidates) {
  var indexed = candidates.map(function (candidate, index) {
    var copy = {};
    var key;

    for (key in candidate) {
      if (Object.prototype.hasOwnProperty.call(candidate, key)) {
        copy[key] = candidate[key];
      }
    }

    copy.index = index;

    return copy;
  });
  var accepted = [];
  var rejected = [];

  indexed.sort(compareForAcceptance).forEach(function (candidate) {
    var blockingCandidate = findBlockingCandidate(accepted, candidate);

    if (blockingCandidate) {
      rejected.push({
        candidate: candidate,
        rejectedBy: blockingCandidate,
        reason: "overlap",
      });
      return;
    }

    accepted.push(candidate);
  });

  accepted.sort(compareByPosition);
  rejected.sort(function (left, right) {
    return compareByPosition(left.candidate, right.candidate);
  });

  var consumedSpans = getConsumedSpans(accepted);

  return {
    accepted: accepted,
    rejected: rejected,
    consumedSpans: consumedSpans,
    unconsumedSpans: getUnconsumedSpans(input, consumedSpans),
  };
};

module.exports = {
  resolveCandidates: resolveCandidates,
  getConsumedSpans: getConsumedSpans,
  getUnconsumedSpans: getUnconsumedSpans,
};
