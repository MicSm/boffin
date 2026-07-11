'use strict';

const {
  PACKAGE_VERSION,
  install,
  uninstall,
  update,
} = require('./installer');
const { resolveTarget } = require('./paths');

const HELP = `Usage: boffinit cursor [install|update|uninstall] [options]

Install Boffin's routed architectural guardrails for Cursor.

Options:
  --target <path>  Repository to manage (default: detected repository root)
  --dry-run        Show the action without writing files
  --help, -h       Show this help
  --version, -V    Show the boffinit version
`;

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return { mode: 'help' };
  }
  if (argv.includes('--version') || argv.includes('-V')) {
    return { mode: 'version' };
  }
  if (argv[0] !== 'cursor') {
    throw new Error('Expected "cursor"; run "boffinit --help" for usage');
  }

  let action = 'install';
  let actionSeen = false;
  let dryRun = false;
  let target;

  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (argument === '--target') {
      if (target !== undefined) {
        throw new Error('--target may be specified only once');
      }
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--target requires a path');
      }
      target = value;
      index += 1;
      continue;
    }
    if (argument.startsWith('-')) {
      throw new Error(`Unknown option "${argument}"; run "boffinit --help" for usage`);
    }
    if (!['install', 'update', 'uninstall'].includes(argument) || actionSeen) {
      throw new Error(`Unknown action "${argument}"; run "boffinit --help" for usage`);
    }
    action = argument;
    actionSeen = true;
  }

  return {
    action,
    dryRun,
    mode: 'command',
    target,
  };
}

async function runCli(argv, options = {}) {
  const {
    cwd = process.cwd(),
    stdout = process.stdout,
  } = options;
  const parsed = parseArgs(argv);

  if (parsed.mode === 'help') {
    stdout.write(HELP);
    return { mode: 'help' };
  }
  if (parsed.mode === 'version') {
    stdout.write(`${PACKAGE_VERSION}\n`);
    return { mode: 'version', version: PACKAGE_VERSION };
  }

  const target = await resolveTarget(parsed.target, cwd);
  const operation = {
    install,
    update,
    uninstall,
  }[parsed.action];
  const result = await operation({
    dryRun: parsed.dryRun,
    target,
  });

  if (parsed.dryRun) {
    if (result.managedFiles.length === 0) {
      stdout.write(`No boffinit installation found at ${result.target}\n`);
    } else {
      stdout.write(
        `Would ${parsed.action} boffinit ${PACKAGE_VERSION} at ${result.target}\n`,
      );
    }
  } else if (!result.changed) {
    stdout.write(`No boffinit installation found at ${result.target}\n`);
  } else {
    const verb = {
      install: 'Installed',
      update: 'Updated',
      uninstall: 'Uninstalled',
    }[parsed.action];
    stdout.write(`${verb} boffinit ${PACKAGE_VERSION} at ${result.target}\n`);
  }

  return result;
}

module.exports = {
  HELP,
  parseArgs,
  runCli,
};
