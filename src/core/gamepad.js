// Gamepad ("if cheap", the brief says: it is). Pure: one snapshot of a standard-mapping pad in,
// the same things the keyboard and mouse give out: analog axes, held keys, key edges, look.
//
//   left stick   walk / in the ship: turn and throttle     right stick   look / point the nose
//   A  Space (jump, jetpack, lift off, rise)               B  C (sink)
//   X  E (board, land, step out)                           Y  V (view)
//   LB X (brake)      RB F (pulse drive)                   LT / RT  throttle down / up in the ship; RT runs on foot
//   L3 run            Back M (map)     Start H (help)      d-pad up B (sketchbook), left / right turn pages, down closes
export const PAD = Object.freeze({
  dead: 0.16,            // stick dead zone
  lookRate: 1050,        // mouse pixels a second at full deflection (about 2.4 rad/s on foot)
  lookCurve: 1.7,        // response curve of the look stick (fine near the centre)
});
const HELD = { 0: 'Space', 1: 'KeyC', 4: 'KeyX', 10: 'ShiftLeft' };
const EDGE = { 0: 'Space', 1: 'KeyC', 2: 'KeyE', 3: 'KeyV', 4: 'KeyX', 5: 'KeyF', 8: 'KeyM', 9: 'KeyH', 12: 'KeyB', 13: 'Enter', 14: 'ArrowLeft', 15: 'ArrowRight' };

const dz = (v, d) => (Math.abs(v) <= d ? 0 : (v - Math.sign(v) * d) / (1 - d));
const val = (b) => (b == null ? 0 : typeof b === 'number' ? b : b.value || (b.pressed ? 1 : 0));

// pad: { axes: [lx, ly, rx, ry], buttons: [{ pressed, value } | number] } (the Gamepad API's shape).
// prev: the `buttons` array returned last time (or null). Returns
// { moveX, moveY (+ forward), lookX, lookY (pixels of mouse travel this frame), throttle (-1..1),
//   run, held: [codes], edges: [codes], buttons: [bool], active }.
export function readPad(pad, prev, dt, T = PAD) {
  const out = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, throttle: 0, run: false, held: [], edges: [], buttons: [], active: false };
  if (!pad || !pad.axes || !pad.buttons) return out;
  const ax = pad.axes;
  out.moveX = dz(ax[0] || 0, T.dead);
  out.moveY = -dz(ax[1] || 0, T.dead) || 0;
  const curve = (v) => Math.sign(v) * Math.pow(Math.abs(v), T.lookCurve);
  out.lookX = curve(dz(ax[2] || 0, T.dead)) * T.lookRate * dt;
  out.lookY = curve(dz(ax[3] || 0, T.dead)) * T.lookRate * dt;
  const lt = val(pad.buttons[6]), rt = val(pad.buttons[7]);
  out.throttle = dz(rt, 0.08) - dz(lt, 0.08);
  out.run = rt > 0.5 || val(pad.buttons[10]) > 0.5;
  for (let i = 0; i < pad.buttons.length; i++) {
    const on = val(pad.buttons[i]) > 0.5;
    out.buttons[i] = on;
    if (on && HELD[i]) out.held.push(HELD[i]);
    if (on && !(prev && prev[i]) && EDGE[i]) out.edges.push(EDGE[i]);
    if (on) out.active = true;
  }
  if (out.moveX || out.moveY || out.lookX || out.lookY || out.throttle) out.active = true;
  return out;
}
