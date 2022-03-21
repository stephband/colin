
import { log, group, groupEnd } from './log.js';

import Collision from './collision.js';
import Renderer  from './renderer.js';

const assign = Object.assign;
const create = Object.create;
const $data  = Symbol('data');

function includes(array1, array2) {
    let n = array1.length;
    while(n--) {
        if (array2.includes(array1[n])) {
            return true;
        }
    }
}

function detectCollisions(t1, t2, detect, objects, collisions, next) {
    // Cycle through objects from end to start
    let b = objects.length;

    while (--b) {
        const objectB = objects[b];

        // Ignore uncollidable objects
        if (objectB.collidable === false) { continue; }

        // Cycle through remaining objects
        let a = b;
        while (a--) {
            // Get current state and state at frame end, t1
            const objectA = objects[a];

            // Ignore uncollidable objects. Objects may be in multiple collision
            // collidable. As long as one match is found, or both are undefined
            // (which is treated as its own group), objects will be tested for
            // collision.
            if (objectA.collidable === false || (
                objectB.collidable ?
                    (!objectA.collidable || !includes(objectB.collidable, objectA.collidable)) :
                    !!objectA.collidable
            )) { continue; }

            const data = detect(objectA, objectB, objectA.data, objectA[$data], objectB.data, objectB[$data]);

            // If no collision
            if (!data) { continue; }

            // Have we detected the same collision again, but with rounding errors?
            // The time and/or position (as it is based on time) may be very slightly not
            // the same on the next iteration, so this crap is about detecting very similar
            // collisions and ignoring them... I wish there were a better way
            /*if (last.find((collision) => (
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

                if (window.DEBUG) {
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

                continue;
            }*/

            // data[0] is the ratio of time from t0 to t1
            const tc = data[0] * (t2 - t1) + t1;

            // Manage the returned collisions
            if (next[0]) {
                if (tc > next[0].time) {
                    continue;
                }

                if (tc < next[0].time) {
                    next.forEach(Collision.release);
                    next.length = 0;
                }
            }

            next.push(Collision(
                tc,
                objectA,
                objectB,
                data
            ));
        }
    }

    return next;
}

function getData2(object) {
    return object[$data] || (object[$data] = new Float64Array(object.size));
}

function setData(object, data) {
    const size  = object.size;

    let n = size;
    while (n--) {
        // position1 = position2
        object.data[n] = data[n];
    }
}

function updateData1(object, t1, t2) {
    const size  = object.size;
    const data  = object.data;

    let n = size;
    while (n--) {
        // position1 = position1 + velocity1 / duration
        data[n] = data[n] + data[size + n] * (t2 - t1);
    }
}

function updateData2(object, t1, t2) {
    const size  = object.size;
    const data  = object.data;
    const data2 = getData2(object);

    let n = size;
    while (n--) {
        // position2 = position1 + velocity1 / duration
        data2[n] = data[n] + data[size + n] * (t2 - t1);
    }
}

function update(t1, t2, detect, collide, objects, collisions, next) {
    // Sanity check t0 against t1, shouldn't happen except may be true
    // if latest collision was exactly at t1
    if (t1 >= t2) {
        throw new Error('Shouldn\'t happen');
        return;
    }

    let n;

    // Get the next collision(s) - if multiple, they must have same time
    next.length = 0;
    next = detectCollisions(t1, t2, detect, objects, collisions, next);

    // If no collisions
    if (!next.length) {
        // Copy extrapolated data at t2 into data, bringing all objects
        // up-to-date with time t2
        n = objects.length;
        while (n--) {
            setData(objects[n], objects[n][$data]);
        }

        // Thus ends the update cycle
        return;
    }

    if (collisions.length > 4) {
        throw new Error('Too many collisions, something must be done')
    }

    const tc = next[0].time;

    // Update object data to time t
    n = objects.length;
    while (n--) {
        updateData1(objects[n], t1, tc);
    }

    // For any objects involved in a collision their object state is updated
    // based on the collision data. We rely on detected data for positions at
    // collision time because if we recalculate from t0 we get rounding errors
    // that increase the number of duplicate collisions that must be filtered -
    // by about twenty-fold or so
    n = next.length;
    while (n--) {
        const collision = next[n];

        // Set positional data at time tc
        setData(collision.objectA, collision.dataA);
        setData(collision.objectB, collision.dataB);

        // Decide what to do on a collision, such as update velocities for example
        collide(collision);

        // Update extrapolated data for collided objects at time t2
        updateData2(collision.objectA, tc, t2);
        updateData2(collision.objectB, tc, t2);

        log(collision.time.toFixed(3), 'collision ' + collision.objectA.type + '-' + collision.objectB.type, collision.point[0], collision.point[1]);
    }

    collisions.push.apply(collisions, next);

    // All objects should now be up-to-date with time tc
    return update(tc, t2, detect, collide, objects, collisions, next);
}

export default function DOMRenderer(element, detect, collide, objects) {
    // Initialise as frame renderer with .startTime, .stopTime, .currentTime, etc.
    Renderer.call(this);

    this.element = element;
    this.objects = objects || [];
    this.detect  = detect;
    this.collide = collide;

    // Hmmmm
    this.collisions = [];
    this.next = [];
}

let r = 1000;

DOMRenderer.prototype = assign(create(Renderer.prototype), {
    render: function(t1, t2) {
        // Stop after r frames
        //if (!r--) { this.stop(); }

        if (!this.objects.length) {
            log('No objects to render');
            return this;
        }

        let n = this.objects.length;
        while (n--) {
            // Call object.update() at the start of the render cycle, giving
            // the object an opportunity to update its state, add
            // dependent objects into the graph or make other changes??
            this.objects[n].update && this.objects[n].update(this);
        }

        // Extrapolate object's data at t2 and glue it to object as [$data]
        n = this.objects.length;
        while (n--) {
            updateData2(this.objects[n], t1, t2);
        }

        // Commence linear extrapolation collision detection cycle
        update(t1, t2, this.detect, this.collide, this.objects, this.collisions, this.next);

        // Render objects
        n = this.objects.length;
        while (n--) {
            this.objects[n].render();
        }

        // Release pooled collisions and empty collisions array
        this.collisions.forEach(Collision.release);
        this.collisions.length = 0;

        return this;
    }
});
