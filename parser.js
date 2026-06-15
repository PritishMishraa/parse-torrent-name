"use strict";

var core = require("./core");
var candidateExtractors = require("./candidate-extractors");
var resolver = require("./resolver");

var Parser = function () {
  this.rules = [];
};

Parser.prototype.addRule = function (rule) {
  if (!rule || typeof rule.match !== "function") {
    throw new TypeError("Parser rules must include a match(ctx) function");
  }

  if (!rule.id || !rule.field || typeof rule.priority !== "number") {
    throw new TypeError("Parser rules must include id, field, and priority");
  }

  this.rules.push(rule);

  return this;
};

Parser.prototype.use = function (rulePack) {
  var self = this;
  var rules = Array.isArray(rulePack) ? rulePack : rulePack && rulePack.rules;

  if (!Array.isArray(rules)) {
    throw new TypeError("Parser.use() expects an array or { rules } rule pack");
  }

  rules.forEach(function (rule) {
    self.addRule(rule);
  });

  return this;
};

Parser.prototype.getCustomCandidates = function (name, options) {
  var ctx = candidateExtractors.createContext(name, options);
  var candidates = [];

  this.rules.forEach(function (rule) {
    candidates = candidates.concat(rule.match(ctx) || []);
  });

  return candidates.sort(function (left, right) {
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
  });
};

Parser.prototype.projectCustomCandidates = function (parts, resolved) {
  resolved.accepted.forEach(function (candidate) {
    if (Object.prototype.hasOwnProperty.call(parts, candidate.field)) {
      return;
    }

    parts[candidate.field] = candidate.value;
  });
};

Parser.prototype.parse = function (name, options) {
  var parts = core.exec(name, options);
  var candidates;
  var resolved;

  if (this.rules.length === 0) {
    return parts;
  }

  candidates = this.getCustomCandidates(name, options);
  resolved = resolver.resolveCandidates(name, candidates);

  this.projectCustomCandidates(parts, resolved);

  if (options && options.includeDebug) {
    parts.debug.customCandidates = candidates;
    parts.debug.customAccepted = resolved.accepted;
    parts.debug.customRejected = resolved.rejected;
  }

  return parts;
};

module.exports = {
  Parser: Parser,
};
