
import { log, group, groupEnd } from './log.js';

import Collision from './collision.js';
import Renderer  from './renderer.js';

const assign = Object.assign;
const create = Object.create;
const $data  = Symbol('data');

// Debug group flag
let g = false;

function includes(array1, array2) {
    let n = array1.length;
    while(n--) {
        if (array2.includes(array1[n])) {
            return true;
        }
    }
}

function detectCollisions(t1, t2, detect, objects, collisions) {
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

            // data[0] is the ratio of time from t1 to t2
            const time = data[0] * (t2 - t1) + t1;

            // Manage the returned collisions
            if (collisions[0]) {
                if (time > collisions[0].time) {
                    continue;
                }

                if (time < collisions[0].time) {
                    collisions.forEach(Collision.release);
                    collisions.length = 0;
                }
            }

            collisions.push(Collision(time, objectA, objectB, data));
        }
    }

    return collisions;
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

function update(t1, t, t2, detect, collide, objects, collisions) {
    let n;

    // Get the next collision(s) - if multiple, they must have same time
    detectCollisions(t, t2, detect, objects, collisions);

    // If no collisions
    if (!collisions.length) {
        // Copy extrapolated data at t2 into data, bringing all objects
        // up-to-date with time t2
        n = objects.length;
        while (n--) {
            setData(objects[n], objects[n][$data]);
        }

        /*if (window.DEBUG && g) {
            g = false;
            groupEnd();
        }*/

        // Thus ends the update cycle
        return;
    }

    if (collisions.length > 12) {
        throw new Error('Too many collisions (>12), is something wrong?');
    }

    /*if (window.DEBUG && !g) {
        g = true;
        group(t1.toFixed(3) + ' - ' + t2.toFixed(3), 'collisions');
    }*/

    const time = collisions[0].time;

    // Update object data to time t
    n = objects.length;
    while (n--) {
        updateData1(objects[n], t, time);
    }

    // For any objects involved in a collision their object state is updated
    // based on the collision data. We rely on detected data for positions at
    // collision time because if we recalculate from t0 we get rounding errors
    // that increase the number of duplicate collisions that must be filtered -
    // by about twenty-fold or so
    n = collisions.length;
    while (n--) {
        const collision = collisions[n];

        // Set positional data at time
        setData(collision.objectA, collision.dataA);
        setData(collision.objectB, collision.dataB);

        // Decide what to do on a collision, such as update velocities
        collide(collision);

        // Update extrapolated data for collided objects at time t2
        updateData2(collision.objectA, time, t2);
        updateData2(collision.objectB, time, t2);

        log(collision.time.toFixed(3), 'collision ' + collision.objectA.type + '[' + collision.objectA.id + ']-' + collision.objectB.type + '[' + collision.objectB.id + ']', collision.point[0], collision.point[1]);

        Collision.release(collision);
    }

    collisions.length = 0;

    // All objects should now be up-to-date with time tc
    return update(t1, time, t2, detect, collide, objects, collisions);
}

export default function DOMRenderer(element, update, detect, collide, objects) {
    // Initialise as frame renderer with .startTime, .stopTime, .currentTime, etc.
    Renderer.call(this);

    this.element = element;
    this.objects = objects || [];
    this.update  = update;
    this.detect  = detect;
    this.collide = collide;

    // Hmmmm
    this.collisions = [];
    this.next = [];
}

DOMRenderer.prototype = assign(create(Renderer.prototype), {
    render: function(t1, t2) {
        const objects = this.objects;

        if (!objects.length) {
            log('No objects to render');
            return this;
        }

        let n = objects.length;
        while (n--) {
            // Call object.update() at the start of the render cycle, giving
            // the object an opportunity to update its state, add
            // dependent objects into the graph or make other changes??
            objects[n].update && objects[n].update(t1, t2, this);
        }

        // Cycle through objects from end to start
        n = objects.length;
        while (--n) {
            const objectB = objects[n];

            // Ignore uncollidable objects
            if (objectB.collidable === false) { continue; }

            // Cycle through remaining objects
            let a = n;
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

                this.update(objectA, objectB, t1, t2);
            }
        }

        // Extrapolate object's data at t2 and glue it to object as [$data]
        n = objects.length;
        while (n--) {
            updateData2(objects[n], t1, t2);
        }

        // Commence linear extrapolation collision detection cycle
        update(t1, t1, t2, this.detect, this.collide, objects, this.collisions, this.next);

        // Render objects
        n = objects.length;
        while (n--) {
            objects[n].render();
        }

        return this;
    }
});
