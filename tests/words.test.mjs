// The words that name the controls (W3.3 of the sharp-smooth plan, src/core/words.js): one name
// for each control, by keyboard, by touch or by pad; every sentence the game says that names a
// control lettered for the hand on the game. On a desktop every sentence reads exactly as it
// always did (the snapshot below is the game's strings before W3.3, word for word); by touch no
// sentence names a key or the mouse.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { words, name, namesAKey, TOUCH_FORMS } from '../src/core/words.js';
import { MAP_TOUCH } from '../src/ui/map.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');

// [as the game now writes it, as the desktop has always read it]
const SNAPSHOT = [
  ['Strolling: {KeyC} for the usual pace', 'Strolling: C for the usual pace'],
  ['{KeyM} opens the map: choose a world there, then {press} {KeyF} to fly to it', 'M opens the map: choose a world there, then press F to fly to it'],
  ['Turn stopped: {KeyF} turns onto the course again', 'Turn stopped: F turns onto the course again'],
  ['Mars lies on your course: {KeyF} goes on round it to Saturn', 'Mars lies on your course: F goes on round it to Saturn'],
  ['The Sun lies on your course: {KeyF} goes on round it', 'The Sun lies on your course: F goes on round it'],
  ['The water is thick: hold {Space} and the jetpack lifts you out', 'The water is thick: hold Space and the jetpack lifts you out'],
  ['Slow down to land: no air to slow the ship here, hold {KeyX}', 'Slow down to land: no air to slow the ship here, hold X'],
  ['Slow down to land: the air is thin here, hold {KeyX}', 'Slow down to land: the air is thin here, hold X'],
  ['Thin air on Mars: the ship runs fast and turns wide. Hold {KeyX} to slow it', 'Thin air on Mars: the ship runs fast and turns wide. Hold X to slow it'],
  ['No air to bank on: the ship turns wide at this speed. Ease off ({KeyS}) and it turns tighter', 'No air to bank on: the ship turns wide at this speed. Ease off (S) and it turns tighter'],
  ['{click} to begin', 'click to begin'],
  ['{KeyH} closes this card', 'H closes this card'],
  ['{KeyB} opens the sketchbook', 'B opens the sketchbook'],
  ['{KeyW KeyA KeyS KeyD} walk   ·   the mouse looks\n{KeyE} boards the ship   ·   {KeyH} shows every key', 'W A S D walk   ·   the mouse looks\nE boards the ship   ·   H shows every key'],
  ['click a world, or use the arrow keys, to set a course', 'click a world, or use the arrow keys, to set a course'],
  ['arrow keys turn the page, {KeyB} closes', 'arrow keys turn the page, B closes'],
  ['click the picture to look around with the mouse', 'click the picture to look around with the mouse'],
  ['hold the left mouse button and drag to look around', 'hold the left mouse button and drag to look around'],
  ['Click or press a key for sound', 'Click or press a key for sound'],
  ['Click again to capture the mouse', 'Click again to capture the mouse'],
  ['Landing cancelled', 'Landing cancelled'],
];

test('the desktop reads every sentence exactly as it always did', () => {
  for (const [t, was] of SNAPSHOT) assert.equal(words(t, 'keys'), was, t);
  // and with a keyboard layout's own letters, as the help card names them (AZERTY: Z Q S D)
  const azerty = { KeyW: 'Z', KeyA: 'Q', KeyS: 'S', KeyD: 'D', KeyE: 'E', KeyH: 'H' };
  assert.equal(words(SNAPSHOT[13][0], 'keys', { labels: azerty }), 'Z Q S D walk   ·   the mouse looks\nE boards the ship   ·   H shows every key');
  // an unknown mode is the keyboard's
  assert.equal(words(SNAPSHOT[2][0], 'telepathy'), SNAPSHOT[2][1]);
});

test('by touch no sentence names a key or the mouse; what is about a control the fingers lack is not said', () => {
  for (const [t] of SNAPSHOT) {
    for (const inShip of [false, true]) {
      const w = words(t, 'touch', { inShip });
      assert.ok(w === null || !namesAKey(w), `by touch: "${w}" (from "${t}")`);
    }
  }
  assert.equal(words('Strolling: {KeyC} for the usual pace', 'touch'), null, 'the stroll has no touch control: not said');
  assert.equal(words('Click again to capture the mouse', 'touch'), null, 'the mouse\'s capture: not said to a finger');
  assert.equal(words('Turn stopped: {KeyF} turns onto the course again', 'touch'), 'Turn stopped: the pulse slip turns onto the course again');
  assert.equal(words('{KeyM} opens the map: choose a world there, then {press} {KeyF} to fly to it', 'touch'), 'The map tab opens the map: choose a world there, then tap the pulse slip to fly to it');
  assert.equal(words('The water is thick: hold {Space} and the jetpack lifts you out', 'touch'), 'The water is thick: hold jump and the jetpack lifts you out');
  assert.equal(words('{click} to begin', 'touch'), 'tap to begin');
  assert.equal(words('{KeyH} closes this card', 'touch'), 'a tap anywhere closes this card');
  // every written touch form says nothing of keys either
  for (const [k, v] of Object.entries(TOUCH_FORMS)) assert.ok(v === null || !namesAKey(words(k, 'touch')), `touch form of "${k}"`);
});

test('the pad names its buttons', () => {
  assert.equal(name('Space', 'pad'), 'A');
  assert.equal(name('KeyF', 'pad'), 'RB');
  assert.equal(name('KeyX', 'pad'), 'LB');
  assert.equal(name('KeyS', 'pad', { inShip: true }), 'LT');
  assert.equal(words('Turn stopped: {KeyF} turns onto the course again', 'pad'), 'Turn stopped: RB turns onto the course again');
  assert.equal(words('{KeyM} opens the map: choose a world there, then {press} {KeyF} to fly to it', 'pad'), 'Back opens the map: choose a world there, then press RB to fly to it');
});

test('one name for every control: keys, touch and pad', () => {
  assert.equal(name('KeyF'), 'F');
  assert.equal(name('Space'), 'Space');
  assert.equal(name('KeyW', 'keys', { labels: { KeyW: 'Z' } }), 'Z');
  assert.equal(name('Space', 'touch'), 'jump');
  assert.equal(name('Space', 'touch', { inShip: true }), 'rise');
  assert.equal(name('KeyC', 'touch'), null);
  assert.equal(name('KeyC', 'touch', { inShip: true }), 'sink');
  assert.equal(name('KeyX', 'touch'), 'brake');
  assert.equal(name('KeyM', 'touch'), 'the map tab');
  // the touch names are the words on the touch HUD's controls (src/ui/hud.js)
  const hud = read('src/ui/hud.js');
  for (const w of ['jump', 'sink', 'brake']) assert.ok(hud.includes(`'${w}'`), 'the touch HUD letters ' + w);
});

test('namesAKey tells a key from a word', () => {
  for (const s of ['B opens the sketchbook', 'press F', 'W A S D walk', 'hold Space', 'the mouse looks', 'arrow keys turn the page', 'click to begin', 'Ease off (S)']) assert.ok(namesAKey(s), s);
  for (const s of ['A view for the sketchbook: the falls', 'Mars ahead', 'the map tab opens the map', 'tap to begin', 'Too steep to land here', 'pulse drive (in space)']) assert.ok(!namesAKey(s), s);
});

// Every sentence in the game's source that is put on the screen (said, a notice, the hint, the
// card's status, the mouse's messages): by touch it names no key, or it is not said.
test('every sentence the source puts on the screen, by touch, names no key and no mouse', () => {
  const files = ['src/core/sim.js', 'src/core/game.js', 'src/core/input.js', 'src/main.js', 'src/ui/map.js', 'src/ui/book.js'];
  const where = /\b(say|setStartStatus|setHint|fallBack|setNotice)\s*\(|\b(message|uiNotice)\s*=|sayFor\(|words\(/;
  let n = 0;
  for (const f of files) {
    for (const line of read(f).split('\n')) {
      if (!where.test(line) || /^\s*\/\//.test(line)) continue;
      for (const m of line.matchAll(/'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`/g)) {
        let s = (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, 'Mars').replace(/\\n/g, '\n').replace(/\\u00b7/g, '·');
        if (!/ /.test(s) || /^[a-z]+\(/.test(s)) continue;           // a sentence, not a name or a code
        n++;
        for (const inShip of [false, true]) {
          const w = words(s, 'touch', { inShip });
          assert.ok(w === null || !namesAKey(w), `${f}: by touch "${w}" (from "${s}")`);
        }
      }
    }
  }
  assert.ok(n >= 25, 'the scan found the sentences: ' + n);
});

test('the map on a touch screen: names 11 css px or more, a world taken within 22 css px, Earth and the Moon two places', () => {
  assert.ok(MAP_TOUCH.name >= 11, 'names lettered at ' + MAP_TOUCH.name);
  assert.ok(MAP_TOUCH.hit >= 22, 'hit radius ' + MAP_TOUCH.hit);
  // a moon drawn MAP_TOUCH.moon css px from its planet: a finger 22 px from either dot is nearer the one it meant
  assert.ok(MAP_TOUCH.moon >= 2 * 22, 'a moon ' + MAP_TOUCH.moon + ' css px from its planet');
});
