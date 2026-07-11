#!/usr/bin/env node
'use strict';

const { buildInstructions } = require('./boffin-instructions');
const {
  readProfile,
  runHook,
  writeHookOutput,
} = require('./boffin-runtime');

runHook(() => {
  const profile = readProfile();
  writeHookOutput('SubagentStart', profile, buildInstructions(profile));
});
