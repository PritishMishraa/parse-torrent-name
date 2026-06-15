"use strict";

var normalizeTitle = require("./normalize");

var uniqueTokens = function (value) {
  var seen = {};

  return normalizeTitle(value)
    .split(" ")
    .filter(Boolean)
    .filter(function (token) {
      if (seen[token]) {
        return false;
      }

      seen[token] = true;
      return true;
    });
};

var titleSimilarity = function (left, right) {
  var leftTokens = uniqueTokens(left);
  var rightTokens = uniqueTokens(right);
  var rightSet = {};
  var overlap = 0;

  if (leftTokens.length === 0 && rightTokens.length === 0) {
    return 1;
  }

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  rightTokens.forEach(function (token) {
    rightSet[token] = true;
  });

  leftTokens.forEach(function (token) {
    if (rightSet[token]) {
      overlap += 1;
    }
  });

  return (2 * overlap) / (leftTokens.length + rightTokens.length);
};

module.exports = titleSimilarity;
module.exports.titleSimilarity = titleSimilarity;
