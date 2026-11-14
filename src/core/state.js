// The core loop as a pure state machine. No three, no DOM: unit-tested in Node.
//
//   ON_FOOT --board--> BOARDING(in) --seated--> LANDED --liftoff--> ATMOSPHERE
//   LANDED --exit--> BOARDING(out) --steppedOut--> ON_FOOT
//   ATMOSPHERE --leftAtmosphere--> SPACE --enteredAtmosphere--> ATMOSPHERE
//   SPACE --pulseOn--> PULSE --pulseOff--> SPACE
//   ATMOSPHERE --beginLanding--> LANDING --touchdown--> LANDED
//   LANDING --abortLanding--> ATMOSPHERE
//
// There is no fail state anywhere: every state has a way back to walking around.

export const S = Object.freeze({
  ON_FOOT: 'ON_FOOT',
  BOARDING: 'BOARDING',
  LANDED: 'LANDED',
  ATMOSPHERE: 'ATMOSPHERE',
  SPACE: 'SPACE',
  PULSE: 'PULSE',
  LANDING: 'LANDING',
});

export const EV = Object.freeze({
  board: 'board',                       // E next to the ship
  seated: 'seated',                     // boarding transition finished
  exit: 'exit',                         // E while landed
  steppedOut: 'steppedOut',             // exit transition finished
  liftoff: 'liftoff',                   // Space while landed
  leftAtmosphere: 'leftAtmosphere',     // climbed above the space edge
  enteredAtmosphere: 'enteredAtmosphere',
  beginLanding: 'beginLanding',         // E with the landing prompt showing
  abortLanding: 'abortLanding',         // throttle or lift during the assisted descent
  touchdown: 'touchdown',
  pulseOn: 'pulseOn',
  pulseOff: 'pulseOff',
});

// state -> event -> [next state, guard(ctx, payload)?]
const TABLE = {
  [S.ON_FOOT]: { [EV.board]: [S.BOARDING] },
  [S.BOARDING]: {
    [EV.seated]: [S.LANDED, (ctx) => ctx.boardingDir === 'in'],
    [EV.steppedOut]: [S.ON_FOOT, (ctx) => ctx.boardingDir === 'out'],
  },
  [S.LANDED]: { [EV.liftoff]: [S.ATMOSPHERE], [EV.exit]: [S.BOARDING] },
  [S.ATMOSPHERE]: { [EV.leftAtmosphere]: [S.SPACE], [EV.beginLanding]: [S.LANDING] },
  [S.SPACE]: { [EV.enteredAtmosphere]: [S.ATMOSPHERE], [EV.pulseOn]: [S.PULSE] },
  [S.PULSE]: { [EV.pulseOff]: [S.SPACE] },
  [S.LANDING]: { [EV.touchdown]: [S.LANDED], [EV.abortLanding]: [S.ATMOSPHERE] },
};

export class StateMachine {
  constructor(initial = S.ON_FOOT) {
    if (!TABLE[initial]) throw new Error('unknown state: ' + initial);
    this.state = initial;
    this.prev = null;
    this.time = 0;                  // seconds spent in the current state
    this.ctx = { boardingDir: null };
    this.history = [initial];       // every state ever entered, in order (for tests and debug)
    this.listeners = [];
  }

  onChange(fn) { this.listeners.push(fn); return this; }

  can(event, payload) {
    const row = TABLE[this.state][event];
    if (!row) return false;
    return !row[1] || row[1](this.ctx, payload) === true;
  }

  // Returns true when the event caused a transition. Unknown or disallowed events are ignored
  // (never throw): input can arrive at any time and must not be able to break the loop.
  dispatch(event, payload) {
    if (!this.can(event, payload)) return false;
    const next = TABLE[this.state][event][0];
    this.prev = this.state;
    this.state = next;
    this.time = 0;
    this.ctx.boardingDir = event === EV.board ? 'in' : event === EV.exit ? 'out' : null;
    this.history.push(next);
    if (this.history.length > 200) this.history.shift();
    for (const fn of this.listeners) fn(next, this.prev, event, payload);
    return true;
  }

  update(dt) { this.time += dt; }

  // Hard set, for teleports, tests and loading a save. Not used by play.
  force(state, ctx) {
    if (!TABLE[state]) throw new Error('unknown state: ' + state);
    this.prev = this.state;
    this.state = state;
    this.time = 0;
    this.ctx = { boardingDir: null, ...(ctx || {}) };
    this.history.push(state);
    for (const fn of this.listeners) fn(state, this.prev, 'force', null);
  }
}

export const isPiloting = (s) => s === S.ATMOSPHERE || s === S.SPACE || s === S.PULSE || s === S.LANDING;
export const isInShip = (s) => isPiloting(s) || s === S.LANDED;
export const playerHasFlightControl = (s) => s === S.ATMOSPHERE || s === S.SPACE;

// ---- rules that feed events into the machine (pure, so they can be tested) -------------

// Zone of flight from altitude with hysteresis: returns 'atmosphere' or 'space'.
export function flightZone(altitude, spaceAlt, prevZone) {
  if (prevZone === 'atmosphere') return altitude > spaceAlt * 1.1 ? 'space' : 'atmosphere';
  return altitude < spaceAlt ? 'atmosphere' : 'space';
}

export const BOARD_RANGE = 5.0;        // metres from the hatch (generous)
export const BOARD_RANGE_SHIP = 9.0;   // or this close to the ship's centre

export function canBoard(distToHatch, distToShip) {
  return distToHatch <= BOARD_RANGE || distToShip <= BOARD_RANGE_SHIP;
}

export const LAND_PROMPT_ALTITUDE = 90;   // metres above the ground (or the liquid surface)
export const LAND_PROMPT_SPEED = 75;      // m/s
// The landing assist takes the hull over under this speed. E pressed faster than this (the
// prompt is up to LAND_PROMPT_SPEED) first slows the ship with its own brakes, then lands.
export const LAND_BEGIN_SPEED = 12;       // m/s

export function canBeginLanding(state, altitudeAboveGround, speed) {
  return state === S.ATMOSPHERE && altitudeAboveGround <= LAND_PROMPT_ALTITUDE && speed <= LAND_PROMPT_SPEED;
}

// The one line of help shown at the bottom of the screen: { key, text } or null.
export function promptFor(state, q) {
  switch (state) {
    case S.ON_FOOT: return q.canBoard ? { key: 'E', text: 'Board ship' } : q.canEasel ? { key: 'E', text: 'Stand at the easel' } : null;
    case S.LANDED: return { key: 'SPACE', text: 'Lift off', key2: 'E', text2: 'Step out' };
    case S.ATMOSPHERE:
      if (q.liftingOff) return null;
      if (q.slowingToLand) return { key: 'SPACE', text: 'Cancel landing' };
      if (q.canLand) return { key: 'E', text: 'Land here' };
      return null;
    case S.LANDING: return { key: 'SPACE', text: 'Cancel landing' };
    // F with a course takes the ship there whether or not its mark is on the screen (it turns
    // the ship onto the course first): the prompt is true wherever the nose points.
    case S.SPACE: return q.turning ? { key: 'F', text: 'Stop turning' } : q.target ? { key: 'F', text: 'Pulse to ' + q.target } : null;
    case S.PULSE: return { key: 'F', text: 'Drop out of pulse' };
    default: return null;
  }
}
