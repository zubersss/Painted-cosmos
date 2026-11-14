// The scripted runs see a landing through (tests/trip.mjs, tests/touch.mjs): a landing the game
// began and gave back on the way down ("No level ground here", src/ship/flight.js stepLanding's
// 'blocked', src/core/sim.js) is flown on from, as a player does, not waited on for 90 s (the
// verifier's painted trip 2 of 3 on 3cd414b over Saturn). Their --block-landings N gives landings
// back on purpose with tests/browser.mjs giveLandingBack, which must do what the game does: these
// checks hold the two to each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');

test('giveLandingBack does what the game does on a blocked landing', () => {
  const sim = read('src/core/sim.js'), flight = read('src/ship/flight.js'), br = read('tests/browser.mjs');
  const said = (br.match(/export const BLOCKED_NOTICE = '([^']+)'/) || [])[1];
  assert.ok(said, 'tests/browser.mjs names the notice');
  const branch = sim.slice(sim.indexOf("} else if (r === 'blocked') {"), sim.indexOf("} else if (r === 'blocked') {") + 260);
  assert.match(branch, /this\.sm\.dispatch\(EV\.abortLanding\)/, 'the game drops back to the air');
  assert.ok(branch.includes(`this.say('${said}')`), 'and says what the helper says: ' + said);
  assert.match(branch, /this\.emit\('too-steep'\)/);
  const blocked = flight.slice(flight.indexOf("if (!g.liquid && g.slope > 0.3) {") - 200, flight.indexOf("return 'blocked';") + 20);
  assert.match(blocked, /st\.v = V\(\);/, 'the hull stops');
  assert.match(blocked, /st\.landing = null;/, 'the landing is dropped');
  const helper = br.slice(br.indexOf('export function giveLandingBack'), br.indexOf('export function giveLandingBack') + 700);
  for (const re of [/sh\.v = \{ x: 0, y: 0, z: 0 \}/, /sh\.landing = null/, /s\.sm\.dispatch\('abortLanding'\)/, /s\.say\(said\)/, /s\.emit\('too-steep'\)/, /sh\.landing\.gear/])
    assert.match(helper, re);
});

test('the trip and the touch loop fly on from a landing given back, and can give one back on purpose', () => {
  for (const f of ['tests/trip.mjs', 'tests/touch.mjs']) {
    const s = read(f);
    assert.match(s, /until\(\(x\) => x\.state !== 'LANDING', 90\)/, f + ': waits for the landing to end, not for LANDED alone');
    assert.match(s, /givenBack = true/, f + ': knows a landing given back');
    assert.match(s, /if \(givenBack \|\| \//, f + ': flies on from it');
    assert.match(s, /giveLandingBack\(page\)/, f + ': --block-landings');
    assert.match(s, /block-landings/, f);
  }
});
