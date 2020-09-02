
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
    },
    [{"type":"box","data":[0,0,720,405,1]},
     /*{"type":"ball","id":"ball-0","data":[0,0,12,0.216],"location":[155.57768062151595,161.2236988462426,0,0,136.29101593439216,-84.5794692396083,0,0,0,0,0,0],"position":{"value":[702.9052109952653,312.1953735935019],"velocity":[-94.86679932383126,80.18296041148977],"acceleration":[0,0]},"color":"#ff821bbb"},
     {"type":"ball","id":"ball-1","data":[0,0,28,2.744],"location":[40.668502240125676,280.4705663239919,0,0,-18.93132165657687,-147.5888030868764,0,0,0,0,0,0],"position":{"value":[466.0860572183268,243.47475820584333],"velocity":[-181.96704043191852,-95.5575249173161],"acceleration":[0,0]},"color":"red"},
     {"type":"ball","id":"ball-2","data":[0,0,18,0.729],"location":[195.3021336024733,16445.52358084418,0,0,306.28014619726173,122.21623388219382,0,0,0,0,0,0],"position":{"value":[4225.514372555522,36067.7129345658],"velocity":[306.28014619726173,122.21623388219382],"acceleration":[0,0]},"color":"green"},
     {"type":"ball","id":"ball-3","data":[0,0,16,0.512],"location":[80.07356572898071,2310.642729351576,0,0,484.86848926742897,446.1278813986004,0,0,0,0,0,0],"position":{"value":[536.8106637930965,73937.8356701544],"velocity":[-484.86848926742897,446.1278813986004],"acceleration":[0,0]},"color":"blue"},
     {"type":"ball","id":"ball-4","data":[0,0,32,4.096],"location":[35.43247519563831,81.49424945524466,0,0,-218.9696780515498,49.45379513311331,0,0,0,0,0,0],"position":{"value":[580.5177703416626,179.6926561580241],"velocity":[2.9937297493004813,44.08310639163349],"acceleration":[0,0]},"color":"cyan"},
     {"type":"ball","id":"ball-5","data":[0,0,50,15.625],"location":[661.1195796379475,204.41111373006288,0,0,-63.458343648776605,-123.53217705948558,0,0,0,0,0,0],"position":{"value":[277.5250907072697,233.6194083934369],"velocity":[-47.264208703701755,49.479230398896235],"acceleration":[0,0]},"color":"purple"},
     {"type":"ball","id":"ball-6","data":[0,0,15,0.421875],"location":[659.6901089301507,37487.7105019839,0,0,291.4982852840201,320.277399343365,0,0,0,0,0,0],"position":{"value":[540.6294640239223,88909.2244531425],"velocity":[291.4982852840201,320.277399343365],"acceleration":[0,0]},"color":"#ff821bbb"},
     {"type":"ball","id":"ball-7","data":[0,0,22,1.331],"location":[349.64908394002504,374.40685231605784,0,0,96.75269800217815,-36.35011114154322,0,0,0,0,0,0],"position":{"value":[207.72358953962282,52.5586506316064],"velocity":[-315.1066456158625,28.546699929448323],"acceleration":[0,0]},"color":"#ee5500"},
     {"type":"ball","id":"ball-8","data":[0,0,30,3.375],"location":[151.30665104704337,81.5463009931033,0,0,96.79325694096526,-35.58919902735663,0,0,0,0,0,0],"position":{"value":[386.59688502792915,124.53726840781216],"velocity":[-149.16487196754957,-66.66810856664542],"acceleration":[0,0]},"color":"#ff821bbb"},
     {"type":"ball","id":"ball-9","data":[0,0,42,9.261],"location":[285.8804022165778,256.5175119977409,0,0,110.17712104651797,-55.04010248867548,0,0,0,0,0,0],"position":{"value":[296.15939388629823,339.3755939538847],"velocity":[-29.409890264560907,-74.34145193571788],"acceleration":[0,0]},"color":"#ff821bbb"},
     {"type":"ball","id":"ball-10","data":[0,0,38,6.859],"location":[370.07774008721395,87.58227888758925,0,0,141.9806829038278,73.80994029399488,0,0,0,0,0,0],"position":{"value":[133.69802371719302,343.55447869512517],"velocity":[-194.6031478984271,202.8184060964742],"acceleration":[0,0]},"color":"#ff821bbb"},
     {"type":"ball","id":"ball-11","data":[0,0,8,0.064],"location":[706.4323771573953,350.2871433437842,0,0,93.32639209560938,-613.1291512131813,0,0,0,0,0,0],"position":{"value":[113.91124591343387,389.2958414487303],"velocity":[314.07107288418615,49.25129520272094],"acceleration":[0,0]},"color":"#ee5500"}
     */ Ball.of(133.69802371719302, 343.55447869512517, 38, 'red', -194.6031478984271, 202.8184060964742),
        Ball.of(113.91124591343387, 389.2958414487303, 8, 'yellow', 314.07107288418615, 49.25129520272094)
    ]    /*[
        Box.of(0, 0, 720, 405, true),
        Ball.of(120, 120, 12, '#ff821bbb', -60, -60),
        Ball.of(60,  60,  28, 'red', Math.random() * 200, Math.random() * 200),
        Ball.of(360, 120, 18, 'green', Math.random() * 200, Math.random() * 200),
        Ball.of(360, 220, 16, 'blue', Math.random() * 200, Math.random() * 200),
        Ball.of(80,  180, 32, 'cyan', Math.random() * 400, Math.random() * 400),
        Ball.of(430, 330, 50, 'purple', Math.random() * 400, Math.random() * 400),
        Ball.of(80,  300, 15, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(430, 330, 22, '#ee5500',   Math.random() * 400, Math.random() * 400),
        Ball.of(480, 70,  30, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(630, 190, 42, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(280, 180, 38, '#ff821bbb', Math.random() * 400, Math.random() * 400),
        Ball.of(280, 180, 8,  '#ee5500',   Math.random() * 400, Math.random() * 400)
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
