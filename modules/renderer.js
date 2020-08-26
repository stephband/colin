
/**
Renderer(
    // Canvas
    document.getElementById('game-canvas'),
    [0, 0, 720, 405],

    // Frame update functions
    update(t0, t1, object),
    detect(objectA, objectA1, objectB, objectB1),
    collide(collision),
    render(ctx, camera, style, object, t1),

    // Scene objects
    [
        { type: 'ball' },
        { type: 'box' }
    ]
)

Inside a frame the update cycle is run to identify each collision. First
update(t0, t1, object) is called to update the future velocities and positions
of each objects. It should return a new object.

Then for every possible collision pair following the update, detect(a0, a1, b0, b1)
is called. It should return an array of the form [t, x, y] to indicate a collision
has been detected at time ratio t and position x, y.

The collide(collision) function is then called once for each of the earliest
collisions identified. It should be used to make changes to the objects,
such as bouncing them off one another by inverting their velocities. Then the
update cycle is run again.

The update cycle ends when no more collisions are detected before time t1,
then render(ctx, camera, style, object, time) is called to render the updated
objects to canvas.
**/

import { deep } from '../../fn/module.js';

// We can get nasty redetection of already detected collisions. Ignore those on
// the same object near to 0 time later. DOMHighResTimeStamps should be accurate
// to 5 µs, according to MDN. This doesn't mean we can't do our collision
// calculations at higher resolution, though. We don't want to unnecessarily
// miss collisions. That's the risk, here, i wish there were a better way, hmmm...
// https://developer.mozilla.org/en-US/docs/Web/API/DOMHighResTimeStamp
const minSameObjectCollisionTime = 10e-12;

function includes(array1, array2) {
    let n = array1.length;
    while(n--) {
        if (array2.includes(array1[n])) {
            return true;
        }
    }
}

// Internal arrays
const datas   = [];
const returns = [];

function detectCollisions(detect, collisions, t0, t1, objects, objects1) {
    let i = objects.length;

    datas.length = 0;
    returns.length = 0;

    while (--i) {
        const objectA0 = objects[i];
        const objectA1 = objects1[i];

        // Ignore uncollidable objects
        if (objectA0.collide === false) {
            continue;
        }

        let j = i;
        while (j--) {
            const objectB0 = objects[j];
            const objectB1 = objects1[j];

            // Ignore uncollidable objects. Objects may be in multiple collision
            // groups. As long as one match is found, or both are
            // undefined (which is treated as its own group), objects will be
            // tested for collision.
            if (objectB0.collide === false || (objectA0.collide ?
                (!objectB0.collide || !includes(objectA0.collide, objectB0.collide)) :
                !!objectB0.collide)
            ) {
                continue;
            }

            // Ignore collisions with the same object that are
            // less than a given age
            if (collisions.find((collision) => (
                t0 - collision.time < minSameObjectCollisionTime
                && collision.objects.includes(objectA0)
                && collision.objects.includes(objectB0)
            ))) {
                continue;
            }

            const data = detect(objectA0, objectA1, objectB0, objectB1);

            // If collision data is not detected
            if (!data) {
                continue;
            }

            // Manage the returned collisions
            if (datas[0]) {
                if (data[0] === datas[0][0]) {
                    datas.push(data, objectA0, objectB0);
                }
                else if (data[0] < datas[0][0]) {
                    datas.length = 0;
                    datas.push(data, objectA0, objectB0);
                }
            }
            else {
                datas.push(data, objectA0, objectB0);
            }
        }
    }

    let n = datas.length;
    while((n -= 3) > -1) {
        const data = datas[n];
        const a    = datas[n + 1];
        const b    = datas[n + 2];
        returns.push({
            // data[0] is the ratio of time from t0 to t1
            time:    data[0] * (t1 - t0) + t0,
            // Collision [x, y] coordinates
            point:   data.slice(1),
            // Sort objects by type alphabetically so our collision identifiers
            // are sane... but do we want to bake in types in the renderer?
            objects: [a, b] //a.type > b.type ? [b, a] : [a, b]
        });
    }

    return returns;
}

function updateObjects(ctx, viewbox, camera, objects, collisions, t0, t1, update, detect, collide, changes = []) {
    // Copy scene updates to t1 to objects[1]
    objects.forEach((object, i) => changes[i] = deep(changes[i] || {}, update(t0, t1, object)));

    // Get the next collision(s) - if multiple, they must have same time
    const next = detectCollisions(detect, collisions, t0, t1, objects, changes);
    if (!next.length) {
        deep(objects, changes);
        changes.length = 0;
        return;
    }

    const time = next[0].time;
    changes.length = 0;

    // Update scene state to time
    objects.forEach((object) => deep(object, update(t0, time, object)));

    // Call collisions and store them
    next.forEach(collide);
    collisions.push.apply(collisions, next);

    // Keep going (until no more collisions are found in frame)
    return updateObjects(ctx, viewbox, camera, objects, collisions, time, t1, update, detect, collide, changes);
}

function renderObjects(ctx, viewbox, camera, objects, style, t1, render) {
    ctx.clearRect.apply(ctx, viewbox);
    const scale = viewbox[2] / camera[2];
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-camera[0], -camera[1]);
    objects.forEach((object) => render(ctx, camera, style, object, t1));
    ctx.restore();
}

export function Renderer(canvas, viewbox, update, detect, collide, render, camera, objects) {
    canvas.width  = viewbox[2];
    canvas.height = viewbox[3];

    const ctx        = canvas.getContext('2d');
    const changes    = [];
    const collisions = [];
    const style      = getComputedStyle(canvas);

    let t0 = 0;

    function frame(time) {
        // Render up to current time on the next frame, working in seconds
        const t1 = time / 1000;
        collisions.length = 0;

        //if (DEBUG) { console.group('frame', t1); }
        updateObjects(ctx, viewbox, camera, objects, collisions, t0, t1, update, detect, collide, changes);
        renderObjects(ctx, viewbox, camera, objects, style, t1, render);
        //if (DEBUG) { console.groupEnd(); }

        // Cue up next frame
        t0 = t1;
        requestAnimationFrame(frame);
    }

    return {
        canvas: canvas,

        start: function() {
            // We work in seconds
            t0 = window.performance.now() / 1000;
            requestAnimationFrame(frame);
        },

        stop: function() {
            cancelAnimationFrame(frame);
        }
    };
}
