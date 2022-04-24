
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

function setPositionData(size, writeData, readData) {
    let n = size;
    while (n--) {
        writeData[n] = readData[n];
    }
}

function updatePosition1(object, t1, t2) {
    const duration = t2 - t1;
    const size = object.size;
    const data = object.data;

    let n = size;
    while (n--) {
        // position1 = position1 + average velocity * duration
        data[n] = data[n] + data[size + n] * duration;
    }
}

function updatePosition2(object, t1, t2) {
    const duration = t2 - t1;
    const size  = object.size;
    const data  = object.data;
    const data2 = getData2(object);

    let n = size;
    while (n--) {
        // position2 = position1 + average velocity * duration
        data2[n] = data[n] + data[size + n] * duration;
    }
}

function updateDataBegin(object, t1, t2) {
    const duration = t2 - t1;
    const size     = object.size;
    const data     = object.data;
    const data2    = getData2(object);

    let n = size;
    while (n--) {
        // Half acceleration for this frame
        const va = 0.5 * duration * data[size + size + n];

        // Average velocity for this frame is velocity at t1 plus half
        // acceleration
        const vf = data[size + n] = data[size + n] + va;

        // Store projected position at t2
        data2[n] = data[n] + vf * duration;
    }
}

function updateDataEnd(object, t1, t2) {
    const duration = t2 - t1;
    const size     = object.size;
    const data     = object.data;
    const data2    = getData2(object);

    let n = size;
    while (n--) {
        // Half acceleration for this frame
        const va = 0.5 * duration * data[size + size + n];

        // Velocity at t2 is (possibly muutated) frame velocity plus half
        // acceleration. While this incurs minor error for anything that has
        // changed course during the frame, it is at least physically accurate
        // for anything travelling in a straight line.
        const v2 = data[size + n] = data[size + n] + va;

        // Position at t2 copied from projected position
        data[n] = data2[n];
    }
}

function update(t, t2, detect, collide, objects, collisions) {

    // Get the next collision(s) - if multiple, they must have same time
    detectCollisions(t, t2, detect, objects, collisions);

    // If no collisions end the update cycle
    if (!collisions.length) { return; }

    const time = collisions[0].time;

    // Update object data to time t
    let n = objects.length;
    while (n--) {
        updatePosition1(objects[n], t, time);
    }

    // For any objects involved in a collision their object state is updated
    // based on the collision data. We rely on detected data for positions at
    // collision time because if we recalculate from t0 we get rounding errors
    // that increase the number of duplicate collisions that must be filtered -
    // by about twenty-fold or so
    let c = collisions.length;
    while (c--) {
        const collision = collisions[c];

        // Set positional data at time
        setPositionData(collision.objectA.size, collision.objectA.data, collision.dataA);
        setPositionData(collision.objectB.size, collision.objectB.data, collision.dataB);

        // Decide what to do on a collision, such as update velocities
        collide(collision);

        // Update extrapolated data for collided objects at time t2
        updatePosition2(collision.objectA, time, t2);
        updatePosition2(collision.objectB, time, t2);

        log(collision.time.toFixed(3), 'collision ' + collision.objectA.type + '[' + collision.objectA.id + ']-' + collision.objectB.type + '[' + collision.objectB.id + ']', collision.point[0], collision.point[1]);

        Collision.release(collision);
    }

    collisions.length = 0;

    // All objects should now be up-to-date with time tc
    return update(time, t2, detect, collide, objects, collisions);
}

export default function DOMRenderer(element, update, detect, collide, objects, renderBegin, renderEnd) {
    // Initialise as frame renderer with .startTime, .stopTime, .currentTime, etc.
    Renderer.call(this);

    this.element     = element;
    this.objects     = objects || [];
    this.update      = update;
    this.detect      = detect;
    this.collide     = collide;
    this.renderBegin = renderBegin;
    this.renderEnd   = renderEnd;

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
            updateDataBegin(objects[n], t1, t2);
        }

        // Commence linear extrapolation collision detection cycle
        update(t1, t2, this.detect, this.collide, objects, this.collisions, this.next);

        // Copy extrapolated data at t2 into data, bringing all objects
        // up-to-date with time t2
        n = objects.length;
        while (n--) {
            updateDataEnd(objects[n], t1, t2);
        }

        this.renderBegin && this.renderBegin(this.element);

        // Render objects
        n = -1;
        while (++n < objects.length) {
            objects[n].render(this.element);
        }

        this.renderEnd && this.renderEnd(this.element);

        return this;
    }
});
