
//import '../soundstage/nodes/tone-synth.js';
import Soundstage from '../soundstage/module.js';
import { by, get, overload, noop } from '../fn/module.js';
import { mag, angle } from './modules/vector.js';
import { detectCircleCircle, detectBoxCircle } from './modules/collision.js';
import { Renderer } from './modules/renderer.js';
import * as Grid from './modules/grid.js';
import * as Box from './modules/box.js';
import * as Ball from './modules/ball.js';

const sin  = Math.sin;
const cos  = Math.cos;
const pi   = Math.PI;


/* Update */

const update = overload((t0, t1, object) => object.type, {
    'ball':  Ball.update,
    'box':   Box.update,
    default: noop
});


/* Detect */

function toTypes(objectA0, objectA1, objectB0, objectB1) {
    return objectA0.type + ' ' + objectB0.type;
}

const detect = overload(toTypes, {
    'ball ball': function(objectA0, objectA1, objectB0, objectB1) {
        return detectCircleCircle(
            objectA0.data[0] + objectA0.position.value[0],
            objectA0.data[1] + objectA0.position.value[1],
            objectA0.data[2],
            objectA0.data[0] + objectA1.position.value[0],
            objectA0.data[1] + objectA1.position.value[1],
            objectA0.data[2],
            objectB0.data[0] + objectB0.position.value[0],
            objectB0.data[1] + objectB0.position.value[1],
            objectB0.data[2],
            objectB0.data[0] + objectB1.position.value[0],
            objectB0.data[1] + objectB1.position.value[1],
            objectB0.data[2]
        );
    },

    'box ball': function(objectA0, objectA1, objectB0, objectB1) {
        return detectBoxCircle(
            objectA0.data[0],
            objectA0.data[1],
            objectA0.data[2],
            objectA0.data[3],
            objectB0.data[0] + objectB0.position.value[0],
            objectB0.data[1] + objectB0.position.value[1],
            objectB0.data[2],
            objectB0.data[0] + objectB1.position.value[0],
            objectB0.data[1] + objectB1.position.value[1],
            objectB0.data[2]
        );
    },

    'ball box': function(objectA0, objectA1, objectB0, objectB1) {
        return detectBoxCircle(
            objectB0.data[0],
            objectB0.data[1],
            objectB0.data[2],
            objectB0.data[3],
            objectA0.data[0] + objectA0.position.value[0],
            objectA0.data[1] + objectA0.position.value[1],
            objectA0.data[2],
            objectA0.data[0] + objectA1.position.value[0],
            objectA0.data[1] + objectA1.position.value[1],
            objectA0.data[2]
        );
    }
});


/* Collide */

const stage = new Soundstage({
    nodes: [{
        id: 'output',
        type: 'output'
    }]
});

const synth = stage.createNode('instrument', {
    voice: {
        nodes: [{
            id:   'osc-1',
            type: 'tone',
            data: {
                type: 'square',
                detune: -1200
            }
        }, {
            id:   'osc-2',
            type: 'tone',
            data: {
                type: 'sawtooth',
                detune: 1200
            }
        }, {
            id:   'mix-1',
            type: 'mix',
            data: {
                gain: 0.7,
                pan: 0
            }
        }, {
            id:   'mix-2',
            type: 'mix',
            data: {
                gain: 1,
                pan: 0
            }
        }, {
            id:   'gain-envelope',
            type: 'envelope',
            data: {
                attack: [
                    [0,     "step",   0],
                    [0.012, "linear", 1],
                    [0.3,   "exponential", 0.125]
                ],

                release: [
                    [0, "target", 0, 0.1]
                ]
            }
        }, {
            id:   'filter-envelope',
            type: 'envelope',
            data: {
                attack: [
                    [0,     "step",   0],
                    [0.012, "linear", 1],
                    [0.3,   "exponential", 0.125]
                ],

                release: [
                    [0, "target", 0, 0.1]
                ]
            }
        }, {
            id:   'gain',
            type: 'gain',
            data: {
                gain: 0
            }
        }, {
            id:   'filter',
            type: 'biquad-filter',
            data: {
                type: 'lowpass',
                frequency: 120,
                Q: 9
            }
        }],

        connections: [
            { source: 'gain-envelope', target: 'gain.gain' },
            { source: 'filter-envelope', target: 'filter.frequency' },
            { source: 'osc-1', target: 'mix-1' },
            { source: 'osc-2', target: 'mix-2' },
            { source: 'mix-1', target: 'gain' },
            { source: 'mix-2', target: 'gain' },
            { source: 'gain', target: 'filter' }
        ],

        properties: {
            frequency: 'filter.frequency',
            Q: 'filter.Q',
            type: 'filter.type'
        },

        __start: {
            'gain-envelope': {
                gain: {
                    2: { type: 'logarithmic', min: 0.00390625, max: 1 }
                }
            },

            'filter-envelope': {
                gain: {
                    1: { type: 'scale', scale: 1 },
                    2: { type: 'logarithmic', min: 200, max: 20000 }
                }
            },

            'osc-1': {
                frequency: {
                    1: { type: 'none' }
                }
            },

            'osc-2': {
                frequency: {
                    1: { type: 'none' }
                }
            }
        },

        // Can only be 'self' if voice is a node. It isn't.
        output: 'filter'
    },

    output: 1
}).node;
//.then(function(node) {
    console.log('STAGE', stage);
    stage.createConnector(synth, 'output');
    console.log('SYNTH', synth);

    //synth = node;

/*
    stage.__promise.then(function() {
        window.voice = node
        .start(stage.time + 1, 'C3', 0.333333)
        .stop(stage.time + 1.5);

        node
        .start(stage.time + 1.6, 'C3', 0.666667)
        .stop(stage.time + 1.9);

        node
        .start(stage.time + 1.9, 'D3', 0.333333)
        .stop(stage.time + 2.8);

        node
        .start(stage.time + 2.8, 'C3', 0.1)
        .stop(stage.time + 3.2);

        node
        .start(stage.time + 3.7, 'F3', 1)
        .stop(stage.time + 4.5);

        node
        .start(stage.time + 4.6, 'E3', 0.5)
        .stop(stage.time + 5.5);

        setTimeout(function() {
            node
            .start(stage.time + 1, 'C3', 0.0009765625)
            .stop(stage.time + 1.5);

            node
            .start(stage.time + 1.6, 'C3', 1)
            .stop(stage.time + 1.9);
        }, 6000);
    });
*/
//});

function collideBallBall(collision) {
    //const point = collision.point;
    const a = collision.objects[0];
    const b = collision.objects[1];

    //console.log('Colin: ball - ball collision (simple swap velocities, not very realistic)');

    const pa = a.position.value;
    const va = a.position.velocity;
    const pb = b.position.value;
    const vb = b.position.velocity;

    const angleA = angle(va);
    const angleB = angle(vb);
    const angleAB = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]);
    const ma = 4 * pi * a.data[2];
    const mb = 4 * pi * b.data[2];
    const sa = mag(va);
    const sb = mag(vb);

    a.position.velocity[0] = (sa * cos(angleA - angleAB) * (ma - mb) + 2 * mb * sb * cos(angleB - angleAB)) / (ma + mb) * cos(angleAB) + sa * sin(angleA - angleAB) * cos(angleAB + pi / 2);
    a.position.velocity[1] = (sa * cos(angleA - angleAB) * (ma - mb) + 2 * mb * sb * cos(angleB - angleAB)) / (ma + mb) * sin(angleAB) + sa * sin(angleA - angleAB) * sin(angleAB + pi / 2);
    b.position.velocity[0] = (sb * cos(angleB - angleAB) * (mb - ma) + 2 * ma * sa * cos(angleA - angleAB)) / (ma + mb) * cos(angleAB) + sb * sin(angleB - angleAB) * cos(angleAB + pi / 2);
    b.position.velocity[1] = (sb * cos(angleB - angleAB) * (mb - ma) + 2 * ma * sa * cos(angleA - angleAB)) / (ma + mb) * sin(angleAB) + sb * sin(angleB - angleAB) * sin(angleAB + pi / 2);




    if (!synth) { return; }

    const time = stage.timeAtDomTime(collision.time * 1000);

    synth
    .start(time, 60 * collision.objects[0].data[3], 0.25)
    .stop(time + 0.3) ;

    synth
    .start(time, 60 * collision.objects[1].data[3], 0.25)
    .stop(time + 0.3) ;
}

function collideBallBox(collision) {
    const ball = collision.objects[0];
    const box  = collision.objects[1];

    const point = collision.point;
    const data  = box.data;

    // A perfectly elastic collision, for now
    if (point[0] === data[0] || point[0] === data[0] + data[2]) {
        ball.position.velocity[0] *= -1;
    }
    else {
        ball.position.velocity[1] *= -1;
    }




    if (!synth) { return; }

    const time = stage.timeAtDomTime(collision.time * 1000);
console.log(collision);
    synth
    .start(time, 60 * collision.objects[0].data[3], 0.25)
    .stop(time + 0.3) ;
}

const collide = overload((collision) => collision.objects.sort(by(get('type'))).map(get('type')).join('-'), {
    'ball-ball': collideBallBall,
    'ball-box': collideBallBox
});

/* Render */

const getObjectType = (ctx, viewbox, style, object) => object.type;

const render = overload(getObjectType, {
    'ball': Ball.render,
    'box':  Box.render,
});


/* Scene */

Renderer(
    document.getElementById('game-canvas'),
    [0, 0, 720, 405],
    update,
    detect,
    collide,
    render,
    {
        type: 'camera',
        data: [0, 0, 720, 405]
    },
    [
        Box.of(0, 0, 720, 405, true),
        Ball.of(120, 120, 10, Math.random() * 200, Math.random() * 200),
        Ball.of(60, 60, 30,   Math.random() * 200, Math.random() * 200),
        Ball.of(360, 120, 20, Math.random() * 200, Math.random() * 200),
        Ball.of(360, 220, 10, Math.random() * 200, Math.random() * 200),
        Ball.of(80, 180, 30,  Math.random() * 400, Math.random() * 400),
        Ball.of(430, 330, 50, Math.random() * 400, Math.random() * 400),
        Ball.of(80,  400, 15, Math.random() * 400, Math.random() * 400),
        Ball.of(430, 330, 20, Math.random() * 400, Math.random() * 400, '#ee5500'),
        Ball.of(480, 70, 30,  Math.random() * 400, Math.random() * 400),
        Ball.of(630, 190, 42, Math.random() * 400, Math.random() * 400),
        Ball.of(280, 180, 40, Math.random() * 400, Math.random() * 400),
        Ball.of(280, 180, 10, Math.random() * 400, Math.random() * 400, '#ee5500')
    ]
)
.start();
