#!/usr/bin/env node
'use strict';

const { parseProfileCommand } = require('./boffin-config');
const { buildInstructions } = require('./boffin-instructions');
const {
  readProfile,
  runHook,
  setProfile,
  writeHookOutput,
} = require('./boffin-runtime');

runHook((input) => {
  const command = parseProfileCommand(input.prompt);
  if (!command) return;

  if (command.kind === 'report') {
    const profile = readProfile();
    const context = [
      `Boffin profile active: ${profile}. Available profiles: lite, full, max.`,
      '',
      buildInstructions(profile),
    ].join('\n');
    writeHookOutput('UserPromptSubmit', profile, context);
    return;
  }

  const profile = command.profile;
  try {
    setProfile(profile);
  } catch (_) {
    // Keep this turn usable even if the host's writable data is unavailable.
  }

  const context = [
    `Boffin profile changed to ${profile}.`,
    '',
    buildInstructions(profile),
  ].join('\n');
  writeHookOutput('UserPromptSubmit', profile, context);
});
