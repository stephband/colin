
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
    const a = collision.objects[0];
    const b = collision.objects[1];

    const pa = a.position.value;
    const va = a.position.velocity;
    const pb = b.position.value;
    const vb = b.position.velocity;

    const angleA = angle(va[0], va[1]);
    const angleB = angle(vb[0], vb[1]);
    const angleAB = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]);
    const ma = 4 * pi * a.data[2];
    const mb = 4 * pi * b.data[2];
    const sa = mag(va[0], va[1]);
    const sb = mag(vb[0], vb[1]);

    a.position.velocity[0] = (sa * cos(angleA - angleAB) * (ma - mb) + 2 * mb * sb * cos(angleB - angleAB)) / (ma + mb) * cos(angleAB) + sa * sin(angleA - angleAB) * cos(angleAB + pi / 2);
    a.position.velocity[1] = (sa * cos(angleA - angleAB) * (ma - mb) + 2 * mb * sb * cos(angleB - angleAB)) / (ma + mb) * sin(angleAB) + sa * sin(angleA - angleAB) * sin(angleAB + pi / 2);
    b.position.velocity[0] = (sb * cos(angleB - angleAB) * (mb - ma) + 2 * ma * sa * cos(angleA - angleAB)) / (ma + mb) * cos(angleAB) + sb * sin(angleB - angleAB) * cos(angleAB + pi / 2);
    b.position.velocity[1] = (sb * cos(angleB - angleAB) * (mb - ma) + 2 * ma * sa * cos(angleA - angleAB)) / (ma + mb) * sin(angleAB) + sb * sin(angleB - angleAB) * sin(angleAB + pi / 2);

    // Cue sound
    collide(collision, collision.a0, a.location, a);
    collide(collision, collision.b0, b.location, b);
}

function collideBallBox(collision) {
    const ball  = collision.objects[0];
    const box   = collision.objects[1];

    const point = collision.point;
    const data  = box.data;
    
    // A perfectly elastic collision, for now
    if (point[0] === data[0] || point[0] === data[0] + data[2]) {
        ball.position.velocity[0] *= -1;
    }
    else {
        ball.position.velocity[1] *= -1;
    }

    collide(collision, collision.a0, ball.location, ball);
}

const collide = overload((time, loc0, loc1, object) => object.type, {
    'ball': Ball.collide
});


/* Render */

const getObjectType = (ctx, viewbox, style, object) => object.type;

const render = overload(getObjectType, {
    'ball': Ball.render,
    'box':  Box.render,
});
/*
const renderCollision = overload((collision) => , {
    
});
*/
/* Scene */

const renderer = new Renderer(
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
        Ball.of(120, 120, 12, '#ff821bbb', -60, -60),
        Ball.of(60,  60,  28, '#ff821bbb', Math.random() * 200, Math.random() * 200),
        Ball.of(360, 120, 18, '#ff821bbb', Math.random() * 200, Math.random() * 200),
        Ball.of(360, 220, 16, '#ff821bbb', Math.random() * 200, Math.random() * 200),
        Ball.of(80,  180, 32, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(430, 330, 50, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(80,  300, 15, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(430, 330, 22, '#ee5500',   Math.random() * 400, Math.random() * 400),
        Ball.of(480, 70,  30, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(630, 190, 42, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(280, 180, 38, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(280, 180, 8,  '#ee5500',   Math.random() * 400, Math.random() * 400)
    ]
);

var n = false;

document.addEventListener('click', function(e) {
    n = !n;
    if (n) {
        renderer.start();
    }
    else {
        renderer.stop();
    }
});

window.r = renderer;
