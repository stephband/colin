
/*
Marslander

Marslander is based on the original Marslander that came on the introductory
cassette – yes, cassette – of software for the Acorn Electron.
https://www.everygamegoing.com/landingMachineType/index/machine_folder/electron/thing_type/games/
*/

import { get, overload, deep, noop, toCartesian, toPolar } from '../fn/module.js';
import { multiply, subtract, mag, angle } from './modules/vector.js';
import { detect } from './modules/detect.js';
import { detectLinePoint, detectCircleCircle, detectBoxCircle } from './modules/collision_.js';
import * as Grid from './modules/grid.js';
import * as Box from './modules/box.js';
import * as Ball from './modules/ball.js';

const DEBUG = true;
const A = Array.prototype;
const assign  = Object.assign;
const sin  = Math.sin;
const cos  = Math.cos;
const tan  = Math.tan;
const pi   = Math.PI;

// We can get nasty redetection of already detected collisions. Ignore those on
// the same object near to 0 time later. DOMHighResTimeStamps should be accurate
// to 5 µs, according to MDN. This doesn't mean we can't do our collision
// calculations at higher resolution, though. We don't want to unnecessarily
// miss collisions. That's the risk, here, i wish there were a better way, hmmm...
// https://developer.mozilla.org/en-US/docs/Web/API/DOMHighResTimeStamp
const minSameObjectCollisionTime = 10e-12;

const canvas  = document.getElementById('game-canvas');
canvas.width  = 1440;
canvas.height = 810;
const ctx     = canvas.getContext('2d');
const style   = getComputedStyle(canvas);

const getObjectType = (ctx, viewbox, style, object) => object.type;

function toTypes(objectA0, objectA1, objectB0, objectB1) {
    return objectA0.type + ' ' + objectB0.type;
}

const detectCollision = overload(toTypes, {
    'ball ball': function(objectA0, objectA1, objectB0, objectB1) {
        return detect(
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
        )
        .then(function(collision) {
            collision.objects = [objectA0, objectB0];
            return collision;
        });
    },

    'box ball': function(objectA0, objectA1, objectB0, objectB1) {
        return detect(
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
        )
        .then(function(collision) {
            collision.objects = [objectA0, objectB0];
            return collision;
        });
    },

    'ball box': function(objectA0, objectA1, objectB0, objectB1) {
        return detect(
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
        )
        .then(function(collision) {
            collision.objects = [objectB0, objectA0];
            return collision;
        });
    }
});

function collideBoxBall(collision, box, ball) {
    //console.log('Colin: box - ball collision');

    const point = collision.point;
    const data = box.data;

    // A perfectly elastic collision, for now
    if (point[0] === data[0] || point[0] === data[0] + data[2]) {
        ball.position.velocity[0] *= -1;
    }
    else {
        ball.position.velocity[1] *= -1;
    }
}

const collide = overload((collision) => collision.objects.map(get('type')).join(' '), {
    'ball ball': function(collision) {
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
    },

    'box ball': (collision) => collideBoxBall(collision, collision.objects[0], collision.objects[1]),
    'ball box': (collision) => collideBoxBall(collision, collision.objects[1], collision.objects[0])
});

const updateObject = overload((t0, t1, object) => object.type, {
    'ball': Ball.update,
    'box': Box.update,
    default: noop
});

function update(ctx, viewbox, camera, objects, collisions, t0, t1) {
    return updateAsync(objects, collisions, t0, t1);
}




function updateAsync(objects, collisions, t0, t1) {
    let t = t0;

    const promises = [];
    const objects1 = [];

    function copy(object, i) {
        objects1[i] = deep(objects1[i] || {}, updateObject(t, t1, object));
    }

    function update(object) {
        deep(object, updateObject(t0, t, object));
    }

    objects.forEach(copy);

    let i = objects.length;

    while (--i) {
        const objectA0 = objects[i];
        const objectA1 = objects1[i];

        let j = i;

        while (j--) {
            const objectB0 = objects[j];
            const objectB1 = objects1[j];

            // Ignore collisions with the same object that are
            // less than a given age
            if (objectA0.collisions && objectA0.collisions.find(function(collision) {
                const objects = collision.objects;
                let n = -1;

                while (objects[++n]) {
                    if (objects[n] === objectB0) {
                        if (t - collision.time < minSameObjectCollisionTime) {
                            return true;
                        }
                    }
                }
            })) {
                continue;
            }

            promises.push(detectCollision(objectA0, objectA1, objectB0, objectB1));
        }
    }

    return Promise
    .allSettled(promises)
    .then(function(results) {
        const collision = results
        .reduce(function(collision, result) {
            return result.status !== 'fulfilled' ? collision :
                !collision ? result.value :
                result.value.t < collision.t ? result.value :
                collision ;
        }, undefined);

        if (!collision) {
            deep(objects, objects1);
            return objects;
        }

        t0 = t;
        collision.time = t = collision.t * (t1 - t) + t;
        let n = -1;
        while (collision.objects[++n]) {
            const object = collision.objects[n];
            object.collisions = object.collisions || [];
            object.collisions.push(collision);
        }

        collisions.push(collision);
        objects.forEach(update);
        collide(collision);
        return updateAsync(objects, collisions, collision.time, t1);
    });
}




const renderObject = overload(getObjectType, {
    'ball': Ball.render,
    'box':  Box.render,
});

function render(ctx, viewbox, camera, objects, t0, t1) {
    ctx.clearRect.apply(ctx, viewbox);

    const scale = viewbox[2] / camera[2];

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-camera[0], -camera[1]);
    objects.forEach((object) => renderObject(ctx, camera, style, object, t0, t1));
    ctx.restore();
}

function start() {
    const viewbox = [0, 0, canvas.width, canvas.height];

    const camera = {
        type: 'camera',
        data: viewbox
    };

    const objects = [
        Box.create(viewbox[0], viewbox[1], viewbox[2], viewbox[3], true),
        Ball.create(120, 120, 10, Math.random() * 200, Math.random() * 200),
        Ball.create(60, 60, 30, Math.random() * 200, Math.random() * 200),
        Ball.create(360, 120, 20, Math.random() * 200, Math.random() * 200),
        Ball.create(360, 220, 10, Math.random() * 200, Math.random() * 200),
        Ball.create(80, 180, 30, Math.random() * 400, Math.random() * 400),
        Ball.create(430, 330, 50, Math.random() * 400, Math.random() * 400),
        Ball.create(80,  400, 15, Math.random() * 400, Math.random() * 400),
        Ball.create(430, 330, 20, Math.random() * 400, Math.random() * 400, '#ee5500'),
        Ball.create(480, 70, 30, Math.random() * 400, Math.random() * 400),
        Ball.create(630, 190, 42, Math.random() * 400, Math.random() * 400),
        Ball.create(280, 180, 40, Math.random() * 400, Math.random() * 400),
        Ball.create(280, 180, 10, Math.random() * 400, Math.random() * 400, '#ee5500')/*,
        Ball.create(60, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(15, 80, 80, Math.random() * 400, Math.random() * 400),
        Ball.create(35, 40, 40, Math.random() * 400, Math.random() * 400),
        Ball.create(25, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(25, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(45, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(35, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(25, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(35, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(65, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(50, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(55, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(15, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(10, 80, 80, Math.random() * 400, Math.random() * 400),
        Ball.create(30, 40, 40, Math.random() * 400, Math.random() * 400),
        Ball.create(20, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(10, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(40, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(15, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(20, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(30, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(80, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(40, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(50, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(60, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(15, 80, 80, Math.random() * 400, Math.random() * 400),
        Ball.create(35, 40, 40, Math.random() * 400, Math.random() * 400),
        Ball.create(25, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(25, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(45, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(35, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(25, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(35, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(65, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(50, 180, 180, Math.random() * 400, Math.random() * 400),
        Ball.create(55, 130, 130, Math.random() * 400, Math.random() * 400),
        Ball.create(15, 180, 180, Math.random() * 400, Math.random() * 400)*/
    ];

    const collisions = [];

    let t0 = 0;

    function frame(time) {
        const t1 = time / 1000;
        collisions.length = 0;

        //if (DEBUG) { console.group('frame', t1); }
        update(ctx, viewbox, camera, objects, collisions, t0, t1)
        .then(function(objects) {
            render(ctx, viewbox, camera, objects, t0, t1);

            //if (DEBUG) { console.groupEnd(); }

            // Because we are only clearing collisions at the end of the frame we
            // are preventing multiple collisions between the same bodies within
            // the frame... todo: we need a better way of ignoring duplicate
            // collisions... or not producing duplicates in the first place
            objects.forEach(function(object) {
                if (object.collisions) {
                    object.collisions.length = 0;
                }
            });

            // Cue up next frame
            t0 = t1;
            requestAnimationFrame(frame);
        });
    }

    frame(t0);
}


start();

