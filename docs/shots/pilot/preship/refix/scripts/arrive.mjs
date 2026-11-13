// PILOT re-fix probe: every pair of worlds at many game clocks, nose on the course's world
// ('ahead') or dead behind ('behind'), F; then 20 s of coasting. Records the speed on entering
// the chosen world's arrival sphere, the lowest height over its ground, and how the pulse ended.
// node arrive.mjs <root> <ahead|behind> [nTimes] [k] [TMAX]
const [root, where = 'ahead', nS = '24', kS = '3', TM = '160000'] = process.argv.slice(2);
const { Sim } = await import(root + '/src/core/sim.js');
const { S } = await import(root + '/src/core/state.js');
const { BODIES, spaceAltitude } = await import(root + '/src/data/bodies.js');
const { arrivalRadius, PULSE } = await import(root + '/src/ship/pulse.js');
const { stubSurface, stubSpawn } = await import(root + '/src/core/stubs/surface.js');
const { Pad, play, V, sub, norm, len } = await import(root + '/tests/helpers.mjs');
const { qLook, cross } = await import(root + '/src/core/vec.js');
const ALL = ['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const n = +nS, k = +kS;
const rows = [];
let fastIn = 0, low = 0, long = 0, notArr = 0, runs = 0, worstIn = 0, minLow = Infinity, grazes = 0;
for (let i = 0; i < n; i++) {
  const T0 = i * (+TM) / n;
  for (const from of ALL) for (const to of ALL) {
    if (from === to) continue;
    const sim = new Sim({ sampleSurface: stubSurface, getSpawn: (id) => stubSpawn(id).unitDir });
    sim.t = T0;
    const pad = new Pad();
    sim.teleport({ body: from, lat: 10, lon: 30, ship: true, altitude: k * spaceAltitude(BODIES[from]) });
    play(sim, pad, 0.2);
    if (sim.sm.state !== S.SPACE) continue;
    const t = norm(sub(sim.bodyInShipFrame(to), sim.sh.p));
    const side = norm(cross(t, Math.abs(t.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)));
    sim.sh.q = where === 'behind' ? qLook(V(-t.x, -t.y, -t.z), side) : qLook(t, side);
    sim.sh.v = V();
    sim.setTarget(to);
    play(sim, pad, 0.1);
    pad.tap('KeyF');
    runs++;
    let pulsed = false, tP = 0, vIn = null, minAlt = Infinity, minOther = Infinity, otherId = null, ended = null;
    const R = arrivalRadius(BODIES[to]);
    play(sim, pad, 900, {
      fps: 30,
      each: () => {
        if (sim.sm.state === S.PULSE) { pulsed = true; tP += 1 / 30; }
        const d = len(sub(sim.bodyInShipFrame(to), sim.sh.p));
        const v = sim.pulse ? sim.pulse.v : sim.sh.speed;
        if (pulsed && vIn == null && d < R) vIn = v;
        minAlt = Math.min(minAlt, d - BODIES[to].radius);
        if (pulsed) for (const id of ALL) {
          if (id === to || id === from) continue;
          const a = len(sub(sim.bodyInShipFrame(id), sim.sh.p)) - BODIES[id].radius;
          if (a < minOther) { minOther = a; otherId = id; }
        }
        if (pulsed && ended == null && sim.sm.state !== S.PULSE) ended = sim.t;
      },
      until: () => ended != null && sim.t - ended > 20,
    });
    const d1 = len(sub(sim.bodyInShipFrame(to), sim.sh.p));
    const tag = `t${T0.toFixed(0)} ${from}->${to}`;
    const arrived = ended != null && sim.notice && sim.notice.text === BODIES[to].name + ' ahead' || (ended != null && d1 < R * 1.3);
    if (!arrived) notArr++;
    if (vIn != null && vIn > PULSE.exitSpeed * 1.25) fastIn++;
    if (vIn != null) worstIn = Math.max(worstIn, vIn);
    if (minAlt < spaceAltitude(BODIES[to])) low++;
    minLow = Math.min(minLow, minAlt);
    if (ended == null) long++;
    if (minOther < 2 * spaceAltitude(BODIES[otherId] || BODIES.earth)) grazes++;
    rows.push(`${tag}: pulse ${tP.toFixed(0)} s, in at ${vIn == null ? '-' : vIn.toFixed(0)} m/s, lowest ${minAlt.toFixed(0)} m over ${to} (space ${spaceAltitude(BODIES[to])}), end ${(d1 / 1000).toFixed(1)} km (arr ${(R / 1000).toFixed(1)}), nearest other ${otherId} ${minOther.toFixed(0)} m, ${sim.sm.state} ${JSON.stringify(sim.notice && sim.notice.text)}`);
  }
}
console.log(JSON.stringify({ runs, notArrived: notArr, enteredFast: fastIn, worstEntry: Math.round(worstIn), belowSpaceOverDest: low, lowestOverDest: Math.round(minLow), stillPulsing: long, grazedOther: grazes }));
console.log(rows.join('\n'));
