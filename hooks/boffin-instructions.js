'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_PROFILE,
  getPluginRoot,
  normalizeProfile,
} = require('./boffin-config');

const PROFILE_OVERLAYS = Object.freeze({
  lite: 'Prefer the least ambitious implementation and avoid cleanup beyond the requested result.',
  full: 'Use balanced implementation ambition and perform directly relevant cleanup within scope.',
  max: 'Use the highest implementation ambition and cleanup pressure justified by the request while staying within scope.',
});

function loadCanonicalContract(pluginRoot = getPluginRoot()) {
  const contractPath = path.join(pluginRoot, 'AGENTS.md');
  const contract = fs.readFileSync(contractPath, 'utf8').replace(/^\uFEFF/, '');
  if (!contract) throw new Error(`Empty canonical contract: ${contractPath}`);
  return contract;
}

function buildInstructions(profile, options = {}) {
  const activeProfile = normalizeProfile(profile) || DEFAULT_PROFILE;
  const pluginRoot = options.pluginRoot || getPluginRoot(options);
  const canonicalContract = loadCanonicalContract(pluginRoot);
  const overlay = PROFILE_OVERLAYS[activeProfile];

  return [
    `BOFFIN ACTIVE — profile: ${activeProfile}`,
    `Profile overlay: ${overlay}`,
    'The profile changes ambition and cleanup pressure only. It does not weaken S00-S03, EXCLUDES, trust-boundary validation, data-loss prevention, security, or accessibility.',
    `Boffin install root: ${pluginRoot}`,
    'The contract below references pack files through repository-relative paths such as packs/universal/pack.urf.md. Resolve every such packs/ path against the Boffin install root above, not against the working directory.',
    '',
    'Canonical Boffin contract (authoritative; apply in full):',
    '',
    canonicalContract,
  ].join('\n');
}

module.exports = {
  PROFILE_OVERLAYS,
  buildInstructions,
  getBoffinInstructions: buildInstructions,
  loadCanonicalContract,
};
