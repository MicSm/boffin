#!/usr/bin/env node
'use strict';

const { runCli } = require('../lib/cli');

runCli(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`boffinit: ${message.replace(/\s+/g, ' ').trim()}\n`);
  process.exitCode = 1;
});
