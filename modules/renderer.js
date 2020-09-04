
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

import { deep, get, noop, overload } from '../../fn/module.js';
import { toKey } from '../../dom/module.js';
import events from '../../dom/modules/events.js';
import Pool from './pool.js';

const DEBUG = true;

const assign = Object.assign;
const abs    = Math.abs;

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
const returns = [];

// Pool collision objects to avoid creating thousands of things 
// that need to be garbage collected
let n = 0;

const Collision = new Pool(
    function Collision(time, point, a, b) {
        this.count      = ++n;
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

function floatsToArray(key, value) {
    return value.constructor.name === 'Float64Array' ?
        Array.from(value) :
        value;
}

function arrayToFloats(key, value){
    // the reviver function looks for the typed array flag
    if (typeof value === 'object' && "0" in value && typeof value[0] === 'number') {
        // if found, we convert it back to a typed array
        const v = Float64Array.from(value);
        return v;
    }

  // if flag not found no conversion is done
  return value;
}

function detectCollisions(detect, collisions, t0, t1, objects, objects1) {
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

            const data = detect(objectA0, objectA1, objectB0, objectB1);

            // If collision data is not detected
            if (!data) {
                continue;
            }

            // data[0] is the ratio of time from t0 to t1
            const time = data[0] * (t1 - t0) + t0;
var c;
            // Have we detected the same collision again, but with rounding errors?
            // The time and/or position (as it is based on time) may be very slightly not 
            // the same on the next iteration, so this crap is about detecting very similar
            // collisions and ignoring them... I wish there were a better way
            if ((c = collisions.find((collision) => (
                // Within a rounding error of t0
                data[0] < minSameObjectCollisionTime
                // Same objects
                && collision.objects[0] === objectA0
                && collision.objects[1] === objectB0
                // With roughly the same collision point
                && abs(collision.point[0]) < abs(data[1]) + minSameObjectCollisionTime
                && abs(collision.point[1]) < abs(data[2]) + minSameObjectCollisionTime
            )))) {
                // I'm very surprised by how many similar collisions there are...
console.log('Ignore collision', c.time === time, c.time, c.point[0], c.point[1]);
console.log('                ', '    ',   time, data[1],    data[2]);
console.log('                ', data[0]);
                continue;
            }

            // Manage the returned collisions
            if (returns[0]) {
                if (time > returns[0].time) {
                    continue;
                }

                if (time < returns[0].time) {
                    returns.forEach(setIdle);
                    returns.length = 0;
                }
            }

            // If data has multiple collision points, create multiple collisions
            let l = data.length;
            while(l) {
                l -= 3;
                returns.push(Collision(
                    time,
                    // data[1,2] is the collision [x, y] point
                    data.slice(l + 1, l + 3),
                    // Todo? Sort objects by type alphabetically so our collision identifiers
                    // are sane... but do we want to bake in types in the renderer? I 
                    // think maybe not. Maybe though.
                    objectA0, 
                    objectB0
                ));
            }
        }
    }

    return returns;
}

function updateObject1(update, object, t0, t1, objects1, i) {
    const object1 = update(t0, t1, object);

    if (object1.position) {
        if (!objects1[i]) {
            objects1[i] = {
                position: {
                    value: Float64Array.of(0, 0),
                    velocity: Float64Array.of(0, 0),
                    acceleration: Float64Array.of(0, 0) 
                }
            };
        }

        objects1[i].position.value[0] = object1.position.value[0];
        objects1[i].position.value[1] = object1.position.value[1];
        objects1[i].position.velocity[0] = object1.position.velocity[0];
        objects1[i].position.velocity[1] = object1.position.velocity[1];
        objects1[i].position.acceleration[0] = object1.position.acceleration[0];
        objects1[i].position.acceleration[1] = object1.position.acceleration[1];
    }
    else {
        if (!objects1[i]) {
            objects1[i] = {};
        }

        delete objects1[i].position;
    }
}

function updateObjects(ctx, viewbox, camera, objects0, collisions, t0, t1, update, detect, collide, objects1 = []) {
    // Sanity check t0 against t1, shouldn't happen except may be true 
    // if latest collision was exactly at t1
    if (t0 >= t1) { return; }

    // Copy scene updates to t1 to objects[1]
    objects0.forEach((object, i) => updateObject1(update, object, t0, t1, objects1, i));

    // Get the next collision(s) - if multiple, they must have same time
    const next = detectCollisions(detect, collisions, t0, t1, objects0, objects1);

    if (!next.length) {
        deep(objects0, objects1);
        objects1.length = 0;
        return;
    }

    const time = next[0].time;

    // Record state
    const record = {
        t0:   t0,
        t1:   t1,
        time: time,
        objects0:   JSON.parse(JSON.stringify(objects0, floatsToArray), arrayToFloats), 
        objects1:   JSON.parse(JSON.stringify(objects1, floatsToArray), arrayToFloats),
        collisions: JSON.parse(JSON.stringify(next, floatsToArray), arrayToFloats)
    };

    records.push(record);

    // Update muteable scene state to time
    objects0.forEach((object) => deep(object, update(t0, time, object)));

    record.objects = JSON.parse(JSON.stringify(objects0, floatsToArray), arrayToFloats);

    // Call collisions and store them
    next.forEach(collide);
    collisions.push.apply(collisions, next);

    objects1.length = 0;
    return updateObjects(ctx, viewbox, camera, objects0, collisions, time, t1, update, detect, collide, objects1);
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

function renderObjectsGhost(ctx, viewbox, camera, objects, collisions, style, t1, renderObject, renderCollision) {
    const scale = viewbox[2] / camera[2];
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-camera[0], -camera[1]);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.globalAlpha = 0.2;
    objects.forEach((object) => renderObject(ctx, camera, style, object, t1));
    //collisions.forEach((collision) => renderCollision(collision));
    ctx.restore();
}

function renderPoint(ctx, viewbox, camera, point) {
    const scale = viewbox[2] / camera[2];
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-camera[0], -camera[1]);
    ctx.beginPath();
    ctx.moveTo(point[0], point[1] - 5);
    ctx.lineTo(point[0], point[1] + 5);
    ctx.moveTo(point[0] - 5, point[1]);
    ctx.lineTo(point[0] + 5, point[1]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

let recordIndex = 0;
window.records = [];

function renderRecord(ctx, viewbox, camera, collisions, style, time, render, record) {
    collisions.length = 0;
    // At collision time
    renderObjects(ctx, viewbox, camera, record.objects, collisions, style, time, render, noop);
    // At t0
    renderObjectsGhost(ctx, viewbox, camera, record.objects0, collisions, style, time, render, noop);
    // At t1
    const objects0 = deep(JSON.parse(JSON.stringify(record.objects0, floatsToArray), arrayToFloats), record.objects1);
    renderObjectsGhost(ctx, viewbox, camera, objects0, collisions, style, time, render, noop);
    // Collisions
    record.collisions.forEach((collision) => renderPoint(ctx, viewbox, camera, collision.point));
    // Log data
    //record = parseRecordJSON(json);

    console.log('frame: ' + record.t1.toFixed(3), 'collisions:', record.collision.length);
    console.log(record.collisions[0].time, record.collisions.reduce((string, collision) => string + collision.objects.map(get('type')).join('-'), ''));
    console.log(record, JSON.stringify(record.objects, floatsToArray));
}

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
    let startTime = undefined;
    let stopTime  = undefined;

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
        recordIndex = records.length;
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





    // 
    events('keydown', document)
    .each(overload(toKey, {
        'left': function(e) {
            // If we are playing do nothing
            if (state === 'playing') { return; }
            --recordIndex;
            if (recordIndex < 0) {
                recordIndex = 0;
                return;
            }
            const json = records[recordIndex];
            if (!json) { return; }
            renderRecord(ctx, viewbox, camera, collisions, style, renderTime, render, json);
        },

        'right': function(e) {
            // If we are playing do nothing
            if (state === 'playing') { return; }
            ++recordIndex;
            if (recordIndex > records.length - 1) {
                recordIndex = records.length - 1;
                return;
            }
            const json = records[recordIndex];
            if (!json) { return; }
            renderRecord(ctx, viewbox, camera, collisions, style, renderTime, render, json);
        },

        'default': noop
    }));
}
