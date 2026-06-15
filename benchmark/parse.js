"use strict";

var parseTorrentName = require("../");

var samples = [
  "The Walking Dead S05E03 720p HDTV x264-ASAP[ettv]",
  "Hercules.2014.EXTENDED.1080p.WEB-DL.DD5.1.H264-RARBG",
  "Doctor.Who.2005.8x11.Dark.Water.720p.HDTV.x264-FoV[rartv]",
  "[ www.Speed.cd ] -Sons.of.Anarchy.S07E07.720p.HDTV.X264-DIMENSION",
  "Community.s02e20.rus.eng.720p.Kybik.v.Kybe",
  "Game of Thrones - 4x03 - Breaker of Chains",
  "Guardians of the Galaxy (2014) Dual Audio DVDRip AVI",
  "Annabelle.2014.1080p.PROPER.HC.WEBRip.x264.AAC.2.0-RARBG",
];

var iterations = Number(process.argv[2] || 250000);
var start;
var elapsed;
var i;

for (i = 0; i < samples.length; i++) {
  parseTorrentName(samples[i]);
}

start = process.hrtime.bigint();

for (i = 0; i < iterations; i++) {
  parseTorrentName(samples[i % samples.length]);
}

elapsed = Number(process.hrtime.bigint() - start) / 1e9;

console.log(iterations + " parses in " + elapsed.toFixed(3) + "s");
console.log(Math.round(iterations / elapsed).toLocaleString() + " parses/sec");
