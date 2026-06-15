"use strict";

var parser = require("./parser");
var defaultParser = new parser.Parser();

var parseTorrentName = function (name, options) {
  return defaultParser.parse(name, options);
};

parseTorrentName.Parser = parser.Parser;

exports.Parser = parser.Parser;
module.exports = parseTorrentName;
module.exports.Parser = parser.Parser;
