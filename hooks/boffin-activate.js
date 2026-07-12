#!/usr/bin/env node
'use strict';

const { buildInstructions } = require('./boffin-instructions');
const {
  readProfile,
  runHook,
  setProfile,
  writeHookOutput,
} = require('./boffin-runtime');

runHook(() => {
  const profile = readProfile();
  try {
    setProfile(profile);
  } catch (_) {
    // Publishing context is still useful if state initialization is unavailable.
  }

  writeHookOutput('SessionStart', profile, buildInstructions(profile));
});
