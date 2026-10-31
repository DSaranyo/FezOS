const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDuration } = require('../dist/main/main/router/duration.js');
const { parseReminder } = require('../dist/main/main/timers/reminder.js');
const { matchMacro } = require('../dist/main/main/macros/matcher.js');
const { matchStartMenuApp } = require('../dist/main/main/apps/start-menu.js');

test('parses a relative reminder without a model', () => {
  const before = Date.now();
  const parsed = parseReminder('remind me in 20 minutes to stretch', parseDuration);
  assert.equal(parsed.text, 'stretch');
  assert.equal(parsed.kind, 'reminder');
  assert.ok(parsed.endsAt >= before + 20 * 60_000);
  assert.ok(parsed.endsAt <= before + 20 * 60_000 + 1_000);
});

test('parses the time-first reminder phrasing used in voice commands', () => {
  const parsed = parseReminder('remind me tomorrow at 9 to email my professor', parseDuration);
  assert.equal(parsed.text, 'email my professor');
  assert.equal(parsed.kind, 'reminder');
  assert.ok(parsed.endsAt > Date.now());
});

test('matches only exact or very close macro triggers', () => {
  const study = { id: 'study', name: 'Study mode', aliases: ['study time'], confirmation: 'Ready.', steps: [] };
  assert.equal(matchMacro('set up my study mode', [study]).macro.id, 'study');
  assert.equal(matchMacro('study time', [study]).borderline, false);
  assert.equal(matchMacro('explain study modes', [study]), undefined);
});

test('matches Start-menu app names despite speech-to-text spacing', () => {
  const chatgpt = { Name: 'ChatGPT', AppID: 'OpenAI.Codex_2p2nqsd0c76g0!App' };
  assert.equal(matchStartMenuApp([chatgpt], 'chat gpt').AppID, chatgpt.AppID);
});
