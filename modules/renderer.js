
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

import { deep, noop, overload } from '../../fn/module.js';
import { toKey } from '../../dom/module.js';
import events from '../../dom/modules/events.js';
import Pool from './pool.js';

const DEBUG = true;

const assign = Object.assign;

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

// Pool collision objects to avoid creating thousands of things 
// that need to be garbage collected
const Collision = new Pool(
    function Collision(time, point, a, b) {
        this.time       = time;
        this.point      = point;

        this.objects    = this.objects || [];
        this.objects[0] = a;
        this.objects[1] = b;

        this.a0 = this.a0 || new Float64Array(12);
        this.b0 = this.b0 || new Float64Array(12);

        assign(this.a0, a.location);
        assign(this.b0, b.location);

        this.idle = false;
    },
    function isIdle(collision) {
        return collision.idle;
    }
);

function setIdle(collision) {
    collision.idle = true;
}

function detectCollisions(detect, collisions, t0, t1, objects, objects1) {
    datas.length = 0;
    returns.length = 0;

    // Cycle through objects from end to start
    let i = objects.length;
    while (--i) {
        // Get current state and state at frame end, t1
        const objectA0 = objects[i];
        const objectA1 = objects1[i];

        // Ignore uncollidable objects
        if (objectA0.collide === false) {
            continue;
        }

        // Cycle through remaining objects
        let j = i;
        while (j--) {
            // Get current state and state at frame end, t1
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

        // If data has multiple collision points, create multiple collisions
        let l = data.length;
        while(l) {
            l = l - 3;
            returns.push(Collision(
                // data[0] is the ratio of time from t0 to t1
                data[0] * (t1 - t0) + t0,
                // data[1,2] is the collision [x, y] point
                data.slice(l + 1, l + 3),
                // Sort objects by type alphabetically so our collision identifiers
                // are sane... but do we want to bake in types in the renderer? I 
                // think maybe not. Maybe though.
                a, b //a.type > b.type ? [b, a] : [a, b]
            ));
        }
    }

    return returns;
}

function updateObjects(ctx, viewbox, camera, objects, collisions, t0, t1, update, detect, collide, changes = []) {
    // Copy scene updates to t1 to objects[1]
    objects.forEach((object, i) => changes[i] = deep(changes[i] || {}, update(t0, t1, object)));

    // Get the next collision(s) - if multiple, they must have same time
    const next = detectCollisions(detect, collisions, t0, t1, objects, changes);

    records.push(JSON.stringify({
        objects: objects,
        collisions: collisions
    }, function(key, value) {
        return value.constructor.name === 'Float64Array' ?
            Array.from(value) :
            value;
    }));

    if (!next.length) {
        deep(objects, changes);
        changes.length = 0;
        return;
    }

    const time = next[0].time;
    changes.length = 0;

    // Update muteable scene state to time
    objects.forEach((object) => deep(object, update(t0, time, object)));

    // Call collisions and store them
    next.forEach(collide);
    collisions.push.apply(collisions, next);

    // Keep going (until no more collisions are found in frame)
    return updateObjects(ctx, viewbox, camera, objects, collisions, time, t1, update, detect, collide, changes);
}

function renderObjects(ctx, viewbox, camera, objects, collisions, style, t1, renderObject, renderCollision) {
    ctx.clearRect.apply(ctx, viewbox);
    const scale = viewbox[2] / camera[2];
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-camera[0], -camera[1]);
    objects.forEach((object) => renderObject(ctx, camera, style, object, t1));
    //collisions.forEach((collision) => renderCollision(collision));
    ctx.restore();
}

let recordIndex = 0;
window.records = [];

export function Renderer(canvas, viewbox, update, detect, collide, render, camera, objects) {
    // Has Renderer been called without `new`? 
    if (!Renderer.prototype.isPrototypeOf(this)) {
        return new Renderer(canvas, viewbox, update, detect, collide, render, camera, objects);
    }

    canvas.width  = viewbox[2];
    canvas.height = viewbox[3];

    const ctx        = canvas.getContext('2d');
    const changes    = [];
    const collisions = [];
    const style      = getComputedStyle(canvas);

    // Track state, one of 'stopped', 'playing', 'hidden'
    let state = 'stopped';

    // Local time in seconds
    let renderTime = 0;

    // DOM times in seconds
    let startTime  = undefined;
    let stopTime   = undefined;

    // Frame id
    let id;

    // Add domTime to collisions... ultimately, we should refactor this
    // when we have a seperate collision render process
    function collideProcess(collision) {
        collision.domTime = domTimeAtTime(collision.time);
        collision.viewbox = viewbox;
        return collide(collision);
    }

    function frame(time) {
        // Render up to current time on the next frame, working in seconds
        const t0 = renderTime;
        const t1 = (time / 1000) - startTime;

        // Empty collisions array
        collisions.forEach(setIdle);
        collisions.length = 0;

        //if (DEBUG) { console.group('frame', t0.toFixed(3), t1.toFixed(3)); }
        updateObjects(ctx, viewbox, camera, objects, collisions, t0, t1, update, detect, collideProcess, changes);
        renderObjects(ctx, viewbox, camera, objects, collisions, style, t1, render, noop);
        //if (DEBUG) { console.groupEnd(); }

        // Cue up next frame
        renderTime = t1;
        id = requestAnimationFrame(frame);
    }

    function start(time) {
        // If we are already started, do nothing
        if (state === 'playing') {
            return;
        }

        // We work in seconds
        startTime = time - renderTime;
        stopTime  = undefined;
        state     = 'playing';
        id = requestAnimationFrame(frame);

        if (DEBUG) { console.log('Colin: renderer start'); }
    }

    function stop() {
        // If we are already stopped, do nothing
        if (state !== 'playing') {
            return;
        }

        // Rendering has already been cued up to renderTime, so use it as stopTime
        stopTime = startTime + renderTime;
        state = 'stopped';
        cancelAnimationFrame(id);

        if (DEBUG) { console.log('Colin: renderer stop'); }
        recordIndex = records.length - 1;
    }

    function timeAtDomTime(domTime) {
        return (domTime / 1000) > stopTime ?
            renderTime :
            (domTime / 1000) - startTime ;
    }

    function domTimeAtTime(time) {
        return (startTime + time) > stopTime ?
            1000 * stopTime :
            1000 * (startTime + time) ;
    }

    this.canvas = canvas;

    this.start = function() {
        start(window.performance.now() / 1000);
    };

    this.stop = function() {
        stop();
    };

    this.timeAtDomTime = timeAtDomTime;
    this.domTimeAtTime = domTimeAtTime;

    document.addEventListener("visibilitychange", function(e) {
        if (document.hidden) {
            if (state === 'playing') {
                stop();

                // Set state so that next visibilitychange knows to restart
                state = 'hidden';
            }
        }
        else {
            if (state === 'hidden') {
                start(e.timeStamp / 1000);
            }
        }
    });




    events('keydown', document)
    .each(overload(toKey, {
        'left': function(e) {
            // If we are already stopped, do nothing
            --recordIndex;
            if (state === 'playing') { return; }
            const json = records[recordIndex];
            if (!json) { return; }
            const record = JSON.parse(json, function(key, value){
                // the reviver function looks for the typed array flag
                if (typeof value === 'object' && "0" in value && typeof value[0] === 'number') {
                    // if found, we convert it back to a typed array
                    const v = Float64Array.from(value);
                    return v;
                }

              // if flag not found no conversion is done
              return value;
            });

            collisions.length = 0;
            renderObjects(ctx, viewbox, camera, record.objects, collisions, style, renderTime, render, noop);
            console.log(record.objects, record.collisions);
        },

        'right': function(e) {
            // If we are already stopped, do nothing
            if (state === 'playing') { return; }
            ++recordIndex;
            const json = records[recordIndex];
            if (!json) { return; }
            const record = JSON.parse(json, function(key, value){
                // the reviver function looks for the typed array flag
                if (typeof value === 'object' && "0" in value && typeof value[0] === 'number') {
                    // if found, we convert it back to a typed array
                    const v = Float64Array.from(value);
                    return v;
                }

              // if flag not found no conversion is done
              return value;
            });

            collisions.length = 0;
            renderObjects(ctx, viewbox, camera, record.objects, collisions, style, renderTime, render, noop);
            console.log(record.objects, record.collisions);
        },

        'default': noop
    }));
}
