
import id       from '../../fn/modules/id.js';
import overload from '../../fn/modules/overload.js';
import clamp    from '../../fn/modules/clamp.js';
import deep     from '../../fn/modules/deep.js';
import get      from '../../fn/modules/get.js';

import { mag } from './vector.js';
import { drawCircle } from './canvas.js';
import { stage } from './stage.js';
import { register } from '../../soundstage/module.js';
import Instrument from '../../soundstage/nodes/instrument.js';

const DEBUG  = true;

const assign = Object.assign;
const define = Object.defineProperties;


/* Sound */

const frameDuration = 1 / 60;
const voice = {
    nodes: [
        // https://en.wikipedia.org/wiki/Natural_frequency

        { id: 'harmonic-1',  type: 'tone', data: { type: 'triangle', detune: 0 }},
        { id: 'gain-1', type: 'gain', data: { gain: 1 }},
        { id: 'harmonic-2',  type: 'tone', data: { type: 'sine', detune: 1233.4459459459463 }},
        { id: 'gain-2', type: 'gain', data: { gain: 0.7361961570945943 }},
        { id: 'harmonic-3',  type: 'tone', data: { type: 'sine', detune: 1895.2702702702704 }},
        { id: 'gain-3', type: 'gain', data: { gain: 0.3135029560810816 }},
        { id: 'harmonic-4',  type: 'tone', data: { type: 'sine', detune: 5170.945945945947 }},
        { id: 'gain-4', type: 'gain', data: { gain: 0.08 }},
        { id: 'harmonic-5',  type: 'tone', data: { type: 'triangle', detune: 1189 }},
        { id: 'gain-5', type: 'gain', data: { gain: 0.607 }},
        { id: 'harmonic-6',  type: 'tone', data: { type: 'sine', detune: 3012 }},
        { id: 'gain-6', type: 'gain', data: { gain: 0.05125 }},
        { id: 'envelope', type: 'envelope', data: {
            attack: [
                [0,     "step",   0],
                [0.0016, "linear", 1],
                [0.0026, "target", 0, 0.24]
            ],
            release: [
                [0, "step", 1],
                [0.04, "linear", 0]
            ]
        }},
        { id: 'mix', type: 'mix', data: { gain: 0, pan: 0 }}
    ],

    connections: [
        { source: 'harmonic-1', target: 'gain-1' },
        { source: 'harmonic-2', target: 'gain-2' },
        { source: 'harmonic-3', target: 'gain-3' },
        { source: 'harmonic-4', target: 'gain-4' },
        { source: 'harmonic-5', target: 'gain-5' },
        { source: 'harmonic-6', target: 'gain-6' },
        { source: 'gain-1',     target: 'mix' },
        { source: 'gain-2',     target: 'mix' },
        { source: 'gain-3',     target: 'mix' },
        { source: 'gain-4',     target: 'mix' },
        { source: 'gain-5',     target: 'mix' },
        { source: 'gain-6',     target: 'mix' },
        { source: 'envelope',   target: 'mix.gain' }
    ],

    commands: [
        { target: 'harmonic-1' },
        { target: 'harmonic-2' },
        { target: 'harmonic-3' },
        { target: 'harmonic-4' },
        { target: 'harmonic-5' },
        { target: 'harmonic-6' },
        {
            target: 'envelope',
            data: {
                // min -48dB
                gain: [
                    // scale in dB/oct, min and max are output clamps on the
                    // resulting gain value
                    { type: 'scale', scale: -6, min: 0, max: 2 },
                    { type: 'logarithmic', min: 0.00390625, max: 1 }
                ],

                rate: [
                    // scale in dB/oct, min and max are output clamps on the
                    // resulting gain value
                    { type: 'scale', scale: 1, min: 0.125, max: 8 }
                ]
            }
        }
    ],

    properties: {
        pan: 'mix.pan'
    },

    output: 'mix'
};

register('bonk', function(context) {
    return new Instrument(context, {
        voice: voice
    });
});

const output = stage.createNode('output');
const bonk   = stage.createNode('bonk', {
    voice: voice
});

stage.createConnector(bonk, output);

if (DEBUG) {
    window.bonk = bonk;
    document.getElementById('instrument').audioNode = bonk.node;
}

// Reusable object for cueing voices
const voiceSettings = {};

function panFromPosition(x) {
    // Avoid hard l/r panning
    return (1.6 * x / 1440) - 0.8;
}

const VX = 4;
const VY = 5;
const VR = 6;

export function collide(collision, loc0, loc1, ball) {
    const stageTime = stage.timeAtDomTime(collision.domTime) + stage.outputLatency + frameDuration;

    // Stopping the previous voice, where it has a short release,
    // saves on creating a lot of voices
    if (ball.voice) {
        ball.voice.stop(stageTime);
    }

    if (!ball.mass) {
        return;
    }

    const vx    = loc1[VX] - loc0[VX];
    const vy    = loc1[VY] - loc0[VY];
    const force = mag(vx, vy);

    voiceSettings.pan = panFromPosition(ball.position.value[0]);
    ball.voice  = bonk.start(
        // time
        stageTime,

        // frequency
        // https://en.wikipedia.org/wiki/Natural_frequency
        //
        // In a mass-spring system, with mass m and spring stiffness k,
        // the natural frequency can be calculated as:
        //
        // f = root(k / m)
        //
        // Where k is a stiffness constant.
        Math.pow(380000 / ball.mass, 0.5) + 'Hz',

        // velocity, clamped to -12dB
        clamp(0, 0.25, force / 6000),

        // settings
        voiceSettings
    );
}


/* Ball */

var n = 0;

function Ball(x, y, radius, color = '#ff821bbb', vx, vy) {
    this.type     = 'ball';
    this.id       = this.type + '-' + (n++);
    this.data     = Float64Array.of(0, 0, radius, radius * radius * radius / 7200);
    this.location = Float64Array.of(x, y, 0, 0, vx, vy, 0, 0, 0, 0, 0, 0);

    this.position = {
        value:        new Float64Array(this.location.buffer, 0,  2),
        velocity:     new Float64Array(this.location.buffer, 32, 2),
        acceleration: new Float64Array(this.location.buffer, 64, 2)
    };

    this.color = color;

    // Non-enumerable properties are not JSONified
    define(this, {
        voice: { writable: true, value: undefined }
    });
}

define(Ball.prototype, {
    radius: {
        get: function() {
            return this.data[2];
        }
    },

    mass: {
        get: function() {
            return this.data[3];
        }
    },
});

export function of(x = 0, y = 0, radius, color, vx, vy) {
    return new Ball(x, y, radius, color, vx, vy);
}

Ball.of = of;


/*  */

const scalarData = {
    value:        0,
    velocity:     0,
    acceleration: 0
};

const vectorData = {
    value:        Float64Array.of(0, 0),
    velocity:     Float64Array.of(0, 0),
    acceleration: Float64Array.of(0, 0)
};

const updateValue = overload((object) => typeof object.value, {
    'number': function(object, duration) {
        const data = scalarData;

        data.velocity = (object.acceleration || 0) * duration;
        data.velocity += (object.velocity || 0);
        data.value = object.value + data.velocity * duration;

        return data;
    },

    'object': function(object, duration) {
        const data = vectorData;

        let n = -1;
        while(++n in data.value) {
            data.velocity[n]  = (object.acceleration ? object.acceleration[n] : 0) * duration;
            data.velocity[n] += (object.velocity ? object.velocity[n] : 0);
            data.value[n]     = object.value[n] + data.velocity[n] * duration;
        }

        return data;
    }
});


// Return value for update

const object1 = {};

export function update(t0, t1, ball) {
    object1.position = updateValue(ball.position, t1 - t0);
    return object1;
}

export function render(ctx, viewbox, style, ball) {
    ctx.save();
    ctx.translate(ball.position.value[0], ball.position.value[1]);
    //ctx.rotate(ball.rotation.value * 2 * Math.PI);

    drawCircle(ctx, ball.data);
    ctx.fillStyle = ball.color || style.getPropertyValue('--ball-fill');
    ctx.fill();
    ctx.restore();
}
