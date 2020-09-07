
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

    //console.log('Collide ball-box', point, data, ball.position.velocity[0]);
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
    [0, 0, 1440, 810],
    update,
    detect,
    overload((collision) => collision.objects.sort(by(get('type'))).map(get('type')).join('-'), {
        'ball-ball': collideBallBall,
        'ball-box': collideBallBox
    }),
    render, {
        type: 'camera',
        data: [0, 0, 1440, 810]
    },
    //
    // TRY THIS!!
    //
    [{"type":"ball","id":"ball-0","data":[0,0,24,1.728],"location":[1065.2218942079198,433.55132289091017,0,0,398.19608225573324,-68.05794731262301,0,0,0,0,0,0],"position":{"value":[1065.2218942079198,433.55132289091017],"velocity":[398.19608225573324,-68.05794731262301],"acceleration":[0,0]},"color":"#ff821bbb","updateTime":244.90768950005898},{"type":"ball","id":"ball-1","data":[0,0,56,21.952],"location":[1201.4800059211043,543.9516820120595,0,0,217.85546123824417,135.68974583388203,0,0,0,0,0,0],"position":{"value":[1201.4800059211043,543.9516820120595],"velocity":[217.85546123824417,135.68974583388203],"acceleration":[0,0]},"color":"red","updateTime":244.90768950005898},{"type":"ball","id":"ball-2","data":[0,0,36,5.832],"location":[1115.9806297143841,401.5583428830271,0,0,220.3318412100787,-23.368938126345043,0,0,0,0,0,0],"position":{"value":[1115.9806297143841,401.5583428830271],"velocity":[220.3318412100787,-23.368938126345043],"acceleration":[0,0]},"color":"green","updateTime":244.90768950005898},{"type":"box","data":[0,0,1440,810,1],"updateTime":244.90768950005898}],
    /*[
        Ball.of(620, 620, 24, '#ff821bbb', -60, -60),
        Ball.of(60,  60,  56, 'red', 300, 100),
        Ball.of(860, 420, 36, 'green', 100, 300),
        Ball.of(960, 220, 32, 'blue', Math.random() * 200, Math.random() * 200),
        Ball.of(80,  180, 64, 'cyan', Math.random() * 400, Math.random() * 400),
        Ball.of(430, 330, 100, 'purple', Math.random() * 400, Math.random() * 400),
        Ball.of(80,  300, 30, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(430, 330, 44, '#ee5500',   Math.random() * 400, Math.random() * 400),
        Ball.of(480, 70,  60, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(630, 190, 82, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(280, 180, 76, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(280, 180, 16,  '#ee5500',   Math.random() * 400, Math.random() * 400),
        Box.of(0, 0, 1440, 810, true)
    ]*/
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
