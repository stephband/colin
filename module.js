
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

const frameDuration = 1 / 60;


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

const forceVector = [];

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

    const av0 = a.position.velocity[0];
    const av1 = a.position.velocity[1];
    const bv0 = b.position.velocity[0];
    const bv1 = b.position.velocity[1];

    a.position.velocity[0] = (sa * cos(angleA - angleAB) * (ma - mb) + 2 * mb * sb * cos(angleB - angleAB)) / (ma + mb) * cos(angleAB) + sa * sin(angleA - angleAB) * cos(angleAB + pi / 2);
    a.position.velocity[1] = (sa * cos(angleA - angleAB) * (ma - mb) + 2 * mb * sb * cos(angleB - angleAB)) / (ma + mb) * sin(angleAB) + sa * sin(angleA - angleAB) * sin(angleAB + pi / 2);
    b.position.velocity[0] = (sb * cos(angleB - angleAB) * (mb - ma) + 2 * ma * sa * cos(angleA - angleAB)) / (ma + mb) * cos(angleAB) + sb * sin(angleB - angleAB) * cos(angleAB + pi / 2);
    b.position.velocity[1] = (sb * cos(angleB - angleAB) * (mb - ma) + 2 * ma * sa * cos(angleA - angleAB)) / (ma + mb) * sin(angleAB) + sb * sin(angleB - angleAB) * sin(angleAB + pi / 2);

    // Cue sound
    forceVector[0] = a.position.velocity[0] - av0;
    forceVector[1] = a.position.velocity[1] - av1;
    const avChange = mag(forceVector);

    forceVector[0] = b.position.velocity[0] - bv0;
    forceVector[1] = b.position.velocity[1] - bv1;
    const bvChange = mag(forceVector);

    collide(collision.time, avChange, a);
    collide(collision.time, bvChange, b);
}

function collideBallBox(collision) {
    const ball = collision.objects[0];
    const box  = collision.objects[1];

    const point = collision.point;
    const data  = box.data;

    const av0 = ball.position.velocity[0];
    const av1 = ball.position.velocity[1];
    
    // A perfectly elastic collision, for now
    if (point[0] === data[0] || point[0] === data[0] + data[2]) {
        ball.position.velocity[0] *= -1;
    }
    else {
        ball.position.velocity[1] *= -1;
    }

    // Cue sound
    forceVector[0] = ball.position.velocity[0] - av0;
    forceVector[1] = ball.position.velocity[1] - av1;
    const avChange = mag(forceVector);

    collide(collision.time, avChange, ball);
}

const collide = overload((time, force, object) => object.type, {
    'ball': Ball.collide
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
    overload((collision) => collision.objects.sort(by(get('type'))).map(get('type')).join('-'), {
        'ball-ball': collideBallBall,
        'ball-box': collideBallBox
    }),
    render, {
        type: 'camera',
        data: [0, 0, 720, 405]
    }, [
        Box.of(0, 0, 720, 405, true),
        Ball.of(120, 120, 12, '#ff821bbb', Math.random() * 200, Math.random() * 200),
        Ball.of(60,  60,  28, '#ff821bbb', Math.random() * 200, Math.random() * 200),
        Ball.of(360, 120, 18, '#ff821bbb', Math.random() * 200, Math.random() * 200),
        Ball.of(360, 220, 16, '#ff821bbb', Math.random() * 200, Math.random() * 200),
        //Ball.of(80,  180, 32, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(430, 330, 50, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(80,  400, 15, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(430, 330, 22, '#ee5500',   Math.random() * 400, Math.random() * 400),
        //Ball.of(480, 70,  30, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(630, 190, 42, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(280, 180, 38, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(280, 180, 8,  '#ee5500',   Math.random() * 400, Math.random() * 400)
    ]
)
.start();
