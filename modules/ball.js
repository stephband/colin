
import { clamp, deep, id, overload } from '../../fn/module.js';
import { drawCircle } from './canvas.js';
import { stage } from './stage.js';
import { register } from '../../soundstage/module.js';
import Instrument from '../../soundstage/nodes/instrument.js';

const assign = Object.assign;
const define = Object.defineProperties;

/* Sound */

const frameDuration = 1 / 60;
const voice = {
    nodes: [
        { id: 'harmonic-1',  type: 'tone', data: { type: 'sine', detune: 0 }},
        { id: 'gain-1', type: 'gain', data: { gain: 1 }},
        { id: 'harmonic-2',  type: 'tone', data: { type: 'sine', detune: 1200 }},
        { id: 'gain-2', type: 'gain', data: { gain: 0.5 }},
        { id: 'harmonic-3',  type: 'tone', data: { type: 'sine', detune: 1800 }},
        { id: 'gain-3', type: 'gain', data: { gain: 0.25 }},
        { id: 'harmonic-4',  type: 'tone', data: { type: 'sine', detune: 2400 }},
        { id: 'gain-4', type: 'gain', data: { gain: 0.125 }},
        { id: 'harmonic-5',  type: 'tone', data: { type: 'sine', detune: 2700 }},
        { id: 'gain-5', type: 'gain', data: { gain: 0.0625 }},
        { id: 'harmonic-6',  type: 'tone', data: { type: 'sine', detune: 3000 }},
        { id: 'gain-6', type: 'gain', data: { gain: 0.03125 }},
        { id: 'envelope', type: 'envelope', data: {
            attack: [
                [0,     "step",   0],
                [0.005, "linear", 1],
                [0.005, "target", 0, 0.1]
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

    __start: {
        'harmonic-1': { frequency: { 1: { type: 'none' }}},
        'harmonic-2': { frequency: { 1: { type: 'none' }}},
        'harmonic-3': { frequency: { 1: { type: 'none' }}},
        'harmonic-4': { frequency: { 1: { type: 'none' }}},
        'harmonic-5': { frequency: { 1: { type: 'none' }}},
        'harmonic-6': { frequency: { 1: { type: 'none' }}},
        'envelope': {
            // min -48dB
            gain: { 2: { type: 'logarithmic', min: 0.00390625, max: 1 }}
        }
    },

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

// Reusable object for cueing voices
const voiceSettings = {};

function panFromPosition(x) {
    // Avoid hard l/r panning
    return (1.6 * x / 720) - 0.8;
}

export function collide(time, force, ball) {
    const t = stage.timeAtDomTime(time * 1000);

    // Clamp to max -12dB
    // node.cue(time, type, note, velocity, duration)
    voiceSettings.pan = panFromPosition(ball.position.value[0]);
    bonk.start(t + stage.outputLatency + frameDuration, 70 - ball.mass * 6, clamp(0, 0.25, force / 6000), voiceSettings);
}



/* Ball */

function Ball(x, y, radius, color = '#ff821bbb', vx, vy) {
    this.data = Float64Array.of(0, 0, radius, radius * radius * radius / 8000);

    this.position = {
        value:        Float64Array.of(x, y),
        velocity:     Float64Array.of(vx, vy),
        acceleration: Float64Array.of(0, 0)
    };

    this.color = color;
}

assign(Ball.prototype, {
    type: 'ball'
});

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
            data.velocity[n] = (object.acceleration ? object.acceleration[n] : 0) * duration;
            data.velocity[n] += (object.velocity ? object.velocity[n] : 0);
            data.value[n] = object.value[n] + data.velocity[n] * duration;
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
