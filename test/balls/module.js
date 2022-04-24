
import noop           from '../../../fn/modules/noop.js';
import overload       from '../../../fn/modules/overload.js';
import toPolar        from '../../../fn/modules/to-polar.js';
import toCartesian    from '../../../fn/modules/to-cartesian.js';
import events         from '../../../dom/modules/events.js';
import { vmin }       from '../../../dom/modules/parse-length.js';
import rect           from '../../../dom/modules/rect.js';
import { select }     from '../../../dom/modules/select.js';
import { detectStaticLineMovingCircle, detectCircleCircle } from '../../modules/detection.js';
import { mag, angle } from '../../modules/vector.js';
import DOMRenderer    from '../../modules/dom-renderer.js';

import Box  from './objects/box.js';
import Ball from './objects/ball.js';

const sin     = Math.sin;
const cos     = Math.cos;
const pi      = Math.PI;
const turn    = 2 * Math.PI;

const element = document.getElementById('stage');

const update = overload((a, b) => a.type + '-' + b.type, {
    'box-ball': function(box, ball, t1, t2) {
        // Detect balls overlapping box cushions and accelerate accordingly.
        // This risks injecting initial energy into the system, which it would
        // be better to avoid.

        const duration = t2 - t1;

        const boxl = box.data[0];
        const boxr = box.data[0] + box.data[2];
        const boxt = box.data[1];
        const boxb = box.data[1] + box.data[3];

        const l = ball.data[0] - ball.data[2];
        const r = ball.data[0] + ball.data[2];
        const t = ball.data[1] - ball.data[2];
        const b = ball.data[1] + ball.data[2];

        const dl = l - boxl;
        const dr = r - boxr;
        const dt = t - boxt;
        const db = b - boxb;

        if (dl < 0) {
            // Simply reverse direction
            ball.data[3] = 2;
            // Make distance cubicly proportional to restoration force?
            //ball.data[3] += -10000 * dl * dl * dl * duration / ball.mass;
        }

        if (dr > 0) {
            // Simply reverse direction
            ball.data[3] = -2;
            // Make distance cubicly proportional to restoration force?
            //ball.data[3] += -10000 * dr * dr * dr * duration / ball.mass;
        }

        if (dt < 0) {
            // Simply reverse direction
            ball.data[4] = 2;
            // Make distance cubicly proportional to restoration force?
            //ball.data[4] += -10000 * dt * dt * dt * duration / ball.mass;
        }

        if (db > 0) {
            // Simply reverse direction
            ball.data[4] = -2;
            // Make distance cubicly proportional to restoration force?
            //ball.data[4] += -10000 * db * db * db * duration / ball.mass;
        }
    },

    default: noop
});

const collisions = {};

const detect = overload((objectA, objectB) => objectA.type + '-' + objectB.type, {
    'box-ball': function(objectA, objectB, a1, a2, b1, b2) {
        let collision, key;

        collisions.top = detectStaticLineMovingCircle(
            // Box top line
            a1[0], a1[1], a1[0] + a1[2], a1[1],
            // Circle at t1
            b1[0], b1[1], b1[2],
            // Circle at t2
            b2[0], b2[1], b2[2]
        );

        collisions.bottom = detectStaticLineMovingCircle(
            // Box bottom line
            a1[0], a1[1] + a1[3], a1[0] + a1[2], a1[1] + a1[3],
            // Circle at t1
            b1[0], b1[1], b1[2],
            // Circle at t2
            b2[0], b2[1], b2[2]
        );

        collisions.left = detectStaticLineMovingCircle(
            // Box left line
            a1[0], a1[1], a1[0], a1[1] + a1[3],
            // Circle at t1
            b1[0], b1[1], b1[2],
            // Circle at t2
            b2[0], b2[1], b2[2]
        );

        collisions.right = detectStaticLineMovingCircle(
            // Box right line
            a1[0] + a1[2], a1[1], a1[0] + a1[2], a1[1] + a1[3],
            // Circle at t1
            b1[0], b1[1], b1[2],
            // Circle at t2
            b2[0], b2[1], b2[2]
        );

        // Choose the earliest of the four possible collisions
        for (key in collisions) {
            if (collisions[key]) {
                if (collision) {
                    if (collisions[key][0] < collision[0]) {
                        collision = collisions[key];
                    }
                }
                else {
                    collision = collisions[key];
                }
            }
        }

        if (!collision) { return; }

        // Overwrite line xs, ys, xe, ye with box data (box does not move)
        collision[3] = objectA.data[0];
        collision[4] = objectA.data[1];
        collision[5] = objectA.data[2];
        collision[6] = objectA.data[3];

        return collision;
    },

    'ball-ball': function(objectA, objectB, a1, a2, b1, b2) {
        return detectCircleCircle(
            // CircleA at t1 ... t2
            a1[0], a1[1], a1[2], a2[0], a2[1], a2[2],
            // CircleB at t1 ... t2
            b1[0], b1[1], b1[2], b2[0], b2[1], b2[2]
        );
    },

    default: function(objectA, objectB) {
        const type = objectA.type + '-' + objectB.type;
        console.log('No detector for "' + type + '" collision');
    }
});

const collide = overload((collision) => collision.objectA.type + '-' + collision.objectB.type, {
    'box-ball': function(collision) {
        const point    = collision.point;
        const ball  = collision.objectB;
        const polarCol = toPolar([point[0] - ball.data[0], point[1] - ball.data[1]]);
        const polarVel = toPolar([ball.data[3], ball.data[4]]);

        // Plane of reflection
        polarCol[1] += 0.25 * turn;
        polarVel[1] = polarCol[1] + (polarCol[1] - polarVel[1]);

        const cartVel  = toCartesian(polarVel);

        ball.data[3] = cartVel[0];
        ball.data[4] = cartVel[1];
    },

    'ball-ball': function collideBallBall(collision) {
        const a  = collision.objectA;
        const b  = collision.objectB;

        const pa = a.data.slice(0, 3);
        const va = a.data.slice(3, 6);
        const pb = b.data.slice(0, 3);
        const vb = b.data.slice(3, 6);
        const ma = a.mass;
        const mb = b.mass;

        const angleA  = angle(va[0], va[1]);
        const angleB  = angle(vb[0], vb[1]);
        const angleAB = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]);
        const sa      = mag(va[0], va[1]);
        const sb      = mag(vb[0], vb[1]);

        a.data[3] = (sa * cos(angleA - angleAB) * (ma - mb) + 2 * mb * sb * cos(angleB - angleAB)) / (ma + mb) * cos(angleAB) + sa * sin(angleA - angleAB) * cos(angleAB + pi / 2);
        a.data[4] = (sa * cos(angleA - angleAB) * (ma - mb) + 2 * mb * sb * cos(angleB - angleAB)) / (ma + mb) * sin(angleAB) + sa * sin(angleA - angleAB) * sin(angleAB + pi / 2);
        b.data[3] = (sb * cos(angleB - angleAB) * (mb - ma) + 2 * ma * sa * cos(angleA - angleAB)) / (ma + mb) * cos(angleAB) + sb * sin(angleB - angleAB) * cos(angleAB + pi / 2);
        b.data[4] = (sb * cos(angleB - angleAB) * (mb - ma) + 2 * ma * sa * cos(angleA - angleAB)) / (ma + mb) * sin(angleAB) + sb * sin(angleB - angleAB) * sin(angleAB + pi / 2);
    },

    default: function(collision) {
        const type = collision.objectA.type + '-' + collision.objectB.type;
        console.log('No collide() for "' + type + '" collision');
    }
});



/* viewbox */

// Measure element size on initialisation and when window is resized
// We are sizing everything in vmin units. Because reasons.

const viewbox = [0, 0, 100, 100];

function updateViewbox() {
    const width  = element.clientWidth;
    const height = element.clientHeight;

    if (width < height) {
        viewbox[2] = 100;
        viewbox[3] = 100 * height / width;
    }
    else {
        viewbox[2] = 100 * width / height;
        viewbox[3] = 100;
    }
}

events('resize', window).each(updateViewbox);

updateViewbox();


/* objects */

const objects = [];

objects.push(new Box(element, viewbox[0], viewbox[1], viewbox[2], viewbox[3]));

objects.push.apply(objects, select('.ball', element).map((node) => {
    const min   = Math.min(element.clientWidth, element.clientHeight);
    const box   = rect(node);
    const x     = 100 * (box.x + box.width / 2) / min;
    const y     = 100 * (box.y + box.height / 2) / min;
    const r     = 100 * (box.width / 2) / min;
    const style = getComputedStyle(node);
    const vx    = 0;
    const vy    = 0;
    const mass  = parseFloat(style.getPropertyValue('--mass')) || (4 * pi * r * r);

    return new Ball(node, x, y, r, vx, vy, 0, mass);
}));


/* renderer */

// element, viewbox, update, detect, collide, render, camera, objects
const renderer = new DOMRenderer(element, noop, noop, noop, objects);

renderer.start();
