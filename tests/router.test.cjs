const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDuration } = require('../dist/main/main/router/duration.js');
const { normalizeTranscript } = require('../dist/main/main/router/normalize.js');

test('parses common timer durations without a model', () => {
  assert.equal(parseDuration('set a timer for 10 minutes'), 600000);
  assert.equal(parseDuration('timer for an hour and a half'), 5400000);
  assert.equal(parseDuration('90 seconds'), 90000);
});
test('normalizes polite filler without changing the command', () => {
  assert.equal(normalizeTranscript('Hey Fez, could you please set a timer for 5 minutes?'), 'set a timer for 5 minutes');
});
