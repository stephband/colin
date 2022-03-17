
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

import { deep } from '../../fn/modules/deep.js';
import get      from '../../fn/modules/get.js';
import noop     from '../../fn/modules/noop.js';
import overload from '../../fn/modules/overload.js';
import Stream   from '../../fn/stream/stream.js';

import toKey    from '../../dom/modules/to-key.js';
import events   from '../../dom/modules/events.js';

import Pool     from './pool.js';


const DEBUG = true;


const assign = Object.assign;
const define = Object.defineProperties;
const abs    = Math.abs;

// We can get nasty redetection of already detected collisions. Ignore those on
// the same object near to 0 time later. DOMHighResTimeStamps should be accurate
// to 5 µs, according to MDN. This doesn't mean we can't do our collision
// calculations at higher resolution, though. We don't want to unnecessarily
// miss collisions. That's the risk, here, i wish there were a better way, hmmm...
// https://developer.mozilla.org/en-US/docs/Web/API/DOMHighResTimeStamp
const minSameObjectCollisionTime = 1e-9;

function includes(array1, array2) {
    let n = array1.length;
    while(n--) {
        if (array2.includes(array1[n])) {
            return true;
        }
    }
}

// Pool collision objects to avoid creating thousands of things
// that need to be garbage collected
let n = 0;

const Collision = new Pool(
    function Collision(time, a, b, point, data, t) {
        this.count      = ++n;
        this.time       = time;
        this.point      = point;

        this.objects    = this.objects || [];
        this.objects[0] = a;
        this.objects[1] = b;

        this.a0 = this.a0 || new Float64Array(12);
        this.b0 = this.b0 || new Float64Array(12);
        this.data = data;

        if (DEBUG) {
            this.t = t;
        }

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

function detectCollisions(detect, collisions, t0, t1, objects, objects1, last, next) {
    // Cycle through objects from end to start
    let i = objects.length;

    if (!i) {
        console.log('No objects');
        return;
    }

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

//console.log(objectB0.color, data, objectB0.position && JSON.stringify(objectB0.position.value, floatsToArray), objectB1.position && JSON.stringify(objectB1.position.value, floatsToArray));

            // If collision data is not detected
            if (!data) { continue; }

            // Have we detected the same collision again, but with rounding errors?
            // The time and/or position (as it is based on time) may be very slightly not
            // the same on the next iteration, so this crap is about detecting very similar
            // collisions and ignoring them... I wish there were a better way
            if (last.find((collision) => (
                // Within a rounding error of t0
                data[0] < minSameObjectCollisionTime
                // Same objects
                && collision.objects[0] === objectA0
                && collision.objects[1] === objectB0
                // With roughly the same collision point
                && abs(collision.point[0]) < abs(data[1]) + minSameObjectCollisionTime
                && abs(collision.point[1]) < abs(data[2]) + minSameObjectCollisionTime
            ))) {
                // I'm very surprised by how many similar collisions there are...
                /*
                if (DEBUG) {
                    console.log('Ignore collision t:', data[0]);

                    const time = data[0] * (t1 - t0) + t0;

                    // Record state
                    records.push({
                        status:     'IGNORED',
                        t:          data[0],
                        t0:         t0,
                        t1:         t1,
                        time:       time,
                        last:       JSON.parse(JSON.stringify(last,     floatsToArray), arrayToFloats),
                        objects0:   JSON.parse(JSON.stringify(objects,  floatsToArray), arrayToFloats),
                        objects1:   JSON.parse(JSON.stringify(objects1, floatsToArray), arrayToFloats),
                        objects:    JSON.parse(JSON.stringify(objects,  floatsToArray), arrayToFloats),
                        data:       JSON.parse(JSON.stringify(data,     floatsToArray), arrayToFloats),
                        collisions: [{
                            a: objectA0.color,
                            b: objectB0.color
                        }]
                    });
                }
                */

                continue;
            }

            // data[0] is the ratio of time from t0 to t1
            const time = data[0] * (t1 - t0) + t0;

            // Manage the returned collisions
            if (next[0]) {
                if (time > next[0].time) {
                    continue;
                }

                if (time < next[0].time) {
                    next.forEach(setIdle);
                    next.length = 0;
                }
            }

            // If data has multiple collision points, create multiple collisions
            let l = data.length;
            while(l) {
                l -= 9;

console.log(data);
throw new Error('Collision');

                next.push(Collision(
                    time,
                    // Todo? Sort objects by type alphabetically so our collision identifiers
                    // are sane... but do we want to bake in types in the renderer? I
                    // think maybe not. Maybe though.
                    objectA0,
                    objectB0,
                    // Collision point
                    data.slice(l + 1, l + 3),
                    // Position data for a and b
                    data.slice(l + 3),
                    data[0]
                ));
            }
        }
    }

    return next;
}

function clone(clones, object, i) {
    if (!clones[i] || clones[i].type !== object.type) {
        // Clone the object, just the important bits
        clones[i] = {
            type: object.type,
            data: Float64Array.from(object.data),
            size: object.size
        };
    }
    else {
        // Copy data across
        let n = object.data.length;
        while (n--) {
            clones[i].data[n] = object.data[n];
        }
    }

    return clones;
}

function update(t1, t2, object) {
    let n = (object.data.length / object.size) - 1;
    while (n--) {
        let i = object.size;
        while (i--) {
            object.data[n * object.size + i] += (object.data[(n + 1) * object.size + i] / (t2 - t1));
        }
    }
}

function updateObjects(element, viewbox, camera, objects1, collisions, t1, t2, detect, collide, objects2, last, next) {
    // Sanity check t0 against t1, shouldn't happen except may be true
    // if latest collision was exactly at t1
    if (t1 >= t2) {
        throw new Error('Shouldnt happen');
        return;
    }

    objects2.length = objects1.length;

    objects1
    // Clone any objects not yet in objects2
    .reduce(clone, objects2)
    // Update data to t2
    .forEach((object, i) => update(t1, t2, object));

    // Get the next collision(s) - if multiple, they must have same time
    next.length = 0;
    next = detectCollisions(detect, collisions, t1, t2, objects1, objects2, last, next);

    // If no collisions
    if (!next.length) {
        // Copy data at t2 back onto original objects
        let i = objects2.length;
        while (i--) {
            let n = objects1[i].data.length;
            while (n--) {
                objects1[i].data[n] = objects2[i].data[n];
            }
        }
        return;
    }

    const time = next[0].time;

    /*
    if (DEBUG) {
        // Record state
        var record = {
            status:     'COLLIDE',
            t0:         t0,
            t1:         t1,
            time:       time,
            objects0:   JSON.parse(JSON.stringify(objects0, floatsToArray), arrayToFloats),
            objects1:   JSON.parse(JSON.stringify(objects1, floatsToArray), arrayToFloats),
            collisions: JSON.parse(JSON.stringify(next, floatsToArray), arrayToFloats)
        };

        records.push(record);
    }
    */

    next.forEach(function(collision) {
        const objectA = collision.objects[0];
        const objectB = collision.objects[1];
        const data    = collision.data;
        const time    = collision.time;

        // Set collision positional data on objects. We rely on detected data
        // for positions at collision time because if we recalculate from t0
        // we get rounding errors that increase the number of duplicate
        // collisions that must be filtered - by about twenty-fold or so
        //
        // Data here is [xa, ya, ra, xb, yb, rb]
        objectA.data[0] = data[0];
        objectA.data[1] = data[1];
        //objectA.rotation && (objectA.rotation.value    = data[2]);
        objectA.updateTime = time;

        objectB.data[0] = data[3];
        objectB.data[1] = data[4];
        //objectB.rotation && (objectB.rotation.value    = data[5]);
        objectB.updateTime = time;
    });

    // Update muteable scene state to time
    objects.forEach((object) => {
        // If object has already been updated to time or beyond do nothing
        if (time <= object.updateTime) {
            return;
        }

        deep(object, update(t0, time, object));
        object.updateTime = time;
    });

    /*
    if (DEBUG) {
        record.objects = JSON.parse(JSON.stringify(objects0, floatsToArray), arrayToFloats);
    }
    */

    // Call collisions and store them
    next.forEach(collide);
    collisions.push.apply(collisions, next);
    objects1.length = 0;

    // Swap next and last each iteration to reuse buffers
    return updateObjects(element, viewbox, camera, objects0, collisions, time, t1, detect, collide, objects1, next, last);
}

function renderObjects(element, viewbox, camera, objects, collisions, style, t1, renderObject, renderCollision) {
    //ctx.clearRect.apply(ctx, viewbox);
    //const scale = viewbox[2] / camera[2];
    //ctx.save();
    //ctx.scale(scale, scale);
    //ctx.translate(-camera[0], -camera[1]);
    objects.forEach((object) => renderObject(element, camera, style, object, t1));
    //collisions.forEach((collision) => renderCollision(collision));
    //ctx.restore();
}

/*
function renderObjectsGhost(element, viewbox, camera, objects, collisions, style, t1, renderObject, renderCollision) {
    //const scale = viewbox[2] / camera[2];
    //ctx.save();
    //ctx.scale(scale, scale);
    //ctx.translate(-camera[0], -camera[1]);
    //ctx.globalCompositeOperation = 'destination-over';
    //ctx.globalAlpha = 0.2;
    objects.forEach((object) => renderObject(element, camera, style, object, t1));
    //collisions.forEach((collision) => renderCollision(collision));
    //ctx.restore();
}
*/

function renderPoint(element, viewbox, camera, point) {
    //const scale = viewbox[2] / camera[2];
    //ctx.save();
    //ctx.scale(scale, scale);
    //ctx.translate(-camera[0], -camera[1]);
    //ctx.beginPath();
    //ctx.moveTo(point[0], point[1] - 5);
    //ctx.lineTo(point[0], point[1] + 5);
    //ctx.moveTo(point[0] - 5, point[1]);
    //ctx.lineTo(point[0] + 5, point[1]);
    //ctx.lineWidth = 1;
    //ctx.font = '9px sans-serif';
    //ctx.textBaseline = 'middle';
    //ctx.fillText(point.map(Math.round).join(', '), point[0] + 7, point[1]);
    //ctx.stroke();
    //ctx.restore();
}

/*
let recordIndex = 0;
window.records = [];

function renderRecord(element, viewbox, camera, collisions, style, time, render, record) {
    collisions.length = 0;
    // At collision time
    renderObjects(element, viewbox, camera, record.objects, collisions, style, time, render, noop);
    // At t0
    renderObjectsGhost(element, viewbox, camera, record.objects0, collisions, style, time, render, noop);
    // At t1
    const objects0 = deep(JSON.parse(JSON.stringify(record.objects0, floatsToArray), arrayToFloats), record.objects1);
    renderObjectsGhost(element, viewbox, camera, objects0, collisions, style, time, render, noop);
    // Collisions
    record.collisions.forEach((collision) => {
        collision.point && renderPoint(element, viewbox, camera, collision.point);
        collision.data  && renderPoint(element, viewbox, camera, collision.data.slice(0,2));
        collision.data  && renderPoint(element, viewbox, camera, collision.data.slice(3,5));
    });

    // Log data
    //record = parseRecordJSON(json);

    console.log('frame: ' + record.t1.toFixed(3), 'collisions:', record.collisions.length);
    console.log(record.time, record.collisions.reduce((string, collision) => string + (collision.objects ? collision.objects.map(get('type')).join('-') : 'Ignored'), ''));
    console.log(record, JSON.stringify(record.objects, floatsToArray));
}
*/

export default function DOMRenderer(element, viewbox, detect, collide, render, objects) {
    // Has Renderer been called without `new`?
    if (!DOMRenderer.prototype.isPrototypeOf(this)) {
        return new DOMRenderer(element, viewbox, update, detect, collide, render, objects);
    }

    //canvas.width  = viewbox[2];
    //canvas.height = viewbox[3];

    const renderer   = this;
    //const ctx        = canvas.getContext('2d');
    const changes    = [];
    const collisions = [];
    const last       = [];
    const next       = [];
    const objects1   = [];
    const style      = getComputedStyle(element);

    // Track state, one of 'stopped', 'playing', 'hidden'
    let state = 'stopped';

    // Local time in seconds
    this.renderTime = 0;

    // DOM times in seconds
    this.startTime = undefined;
    this.stopTime  = undefined;

    // Frame id
    let id;

    // Add domTime to collisions... ultimately, we should refactor this
    // when we have a seperate collision render process
    function collideProcess(collision) {
        collision.domTime = domTimeAtTime(collision.time);
        collision.viewbox = viewbox;
        return collide(collision);
    }

    function wait(time) {
        // Wait until t1 is positive. We must do this because frame times lag
        // DOM time, so when start() is called the first frame is older than
        // startTime. If I'm honest, I still don't fully grok this. Essentially
        // it's the time of the previous rendered frame.
        if (time / 1000 > renderer.startTime) {
            return frame(time);
        }

        // Cue up next frame
        id = requestAnimationFrame(wait);
    }

    function frame(time) {
        // Render up to current time on the next frame, working in seconds
        const t0 = renderer.renderTime;
        const t1 = (time / 1000) - renderer.startTime;

        if (t1 < t0) {  }

        // Empty collisions array
        collisions.forEach(setIdle);
        collisions.length = 0;
        last.length = 0;
        next.length = 0;

        if (DEBUG) { console.group(t1.toFixed(3), 'frame'); }
        updateObjects(element, viewbox, viewbox, objects, collisions, t0, t1, detect, collideProcess, changes, objects1, last, next);
        renderObjects(element, viewbox, viewbox, objects, collisions, style, t1, render, noop);
        if (DEBUG) { console.groupEnd(); }

        // Cue up next frame
        renderer.renderTime = t1;
        id = requestAnimationFrame(frame);
    }

    function start(time) {
        // If we are already started, do nothing
        if (state === 'playing') {
            return;
        }

        // We work in seconds
        renderer.startTime = time - renderer.renderTime;
        renderer.stopTime  = undefined;
        state     = 'playing';
        id = requestAnimationFrame(wait);

        if (DEBUG) {
            console.log('Colin: start', time.toFixed(3));
        }
    }

    function stop() {
        // If we are already stopped, do nothing
        if (state !== 'playing') {
            return;
        }

        // Rendering has already been cued up to renderTime, so use it as stopTime
        renderer.stopTime = renderer.startTime + renderer.renderTime;
        state = 'stopped';
        cancelAnimationFrame(id);

        if (DEBUG) {
            recordIndex = records.length;
            console.log('Colin: stop', renderer.stopTime.toFixed(3));
        }
    }

    this.element = element;

    this.start = function() {
        start(window.performance.now() / 1000);
    };

    this.stop = function() {
        stop();
    };

    // Stop animation while tab is hidden
    events('visibilitychange', document).each(function(e) {
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

    console.log('DOMRenderer', viewbox, objects);

    /*
    if (false) {
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
                renderRecord(element, viewbox, viewbox, collisions, style, this.renderTime, render, json);
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
                renderRecord(element, viewbox, viewbox, collisions, style, this.renderTime, render, json);
            },

            'default': noop
        }));
    }
    */
}

assign(DOMRenderer.prototype, {
    /**
    .timeAtDomTime(domTime)
    **/
    timeAtDomTime: function timeAtDomTime(domTime) {
        return (domTime / 1000) > this.stopTime ?
            this.renderTime :
            (domTime / 1000) - this.startTime ;
    },

    /**
    .domTimeAtTime(time)
    **/
    domTimeAtTime: function domTimeAtTime(time) {
        return (this.startTime + time) > this.stopTime ?
            1000 * this.stopTime :
            1000 * (this.startTime + time) ;
    }
});

define(DOMRenderer.prototype, {
    /**
    .playing
    A boolean indicating whether the node is started and playing (`true`) or
    stopped and idle (`false`).
    **/
    playing: {
      get: function() {
          // We work in seconds
          const time = window.performance.now() / 1000;
          return this.startTime !== undefined
          && (this.startTime <= time)
          && (this.stopTime === undefined
              || this.startTime > this.stopTime
              || time < this.stopTime
          );
      }
    }
});
