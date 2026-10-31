const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanForSpeech, takeSpeakableChunks } = require('../dist/main/main/tts/chunker.js');

test('does not split abbreviations or decimals', () => {
  const result = takeSpeakableChunks('Use e.g. apples. The value is 3.5. Done.');
  assert.deepEqual(result.chunks, ['Use e.g. apples.', 'The value is 3.5.', 'Done.']);
});
test('keeps an unfinished final sentence for a later token', () => {
  const result = takeSpeakableChunks('First sentence. Still arriving');
  assert.deepEqual(result.chunks, ['First sentence.']);
  assert.equal(result.remainder, 'Still arriving');
});
test('cleans markdown and omits fenced code', () => {
  const result = cleanForSpeech('# Heading\n- **Read** [this](https://example.com)\n```js\nsecret()\n```');
  assert.equal(result.text, "Heading Read this I've put the code on screen.");
  assert.equal(result.codeNotice, true);
});
