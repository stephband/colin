
import { choose } from '../../fn/module.js';
import { equal, gradient } from './vector.js';

const abs = Math.abs;
const pow = Math.pow;
const min = Math.min;
const max = Math.max;

function min0To1(a, b) {
    // Get the min of a and b in the range 0 - 1
    return a >= 0 && a < 1 ?
        b >= 0 && b < 1 ?
            min(a, b) :
            a :
        b >= 0 && b < 1 ?
            b :
            undefined ;
}

function isPointInLine(s, e, p) {
    const g = gradient(s, e);

    // Return true where point is inside line bounds and p is
    // the same gradient from s as e is...
    return ((g > -1 && g < 1) ?
        p[0] >= min(s[0], e[0]) && p[0] <= max(s[0], e[0]) :
        p[1] >= min(s[1], e[1]) && p[1] <= max(s[1], e[1]))
    && g === gradient(s, p) ;
}

function timeAtQuadratic(a, b, c) {
    if (b === 0) {
        return c === 0 ?
            // Parallel movement, constant intersection
            // How are we going to figure out start and end of arc tho??
            0 :
            // Parallel movement, no intersection
            undefined ;
    }

    const root = pow(b * b - 4 * a * c, 0.5);
    const ta = (-b + root) / (2 * a);
    const tb = (-b - root) / (2 * a);

    return min0To1(ta, tb);
}

function timeAtOverlap(ys, ye, yp0, yp1) {
    // Is it starting off intersecting?
    if (yp0 > min(ys, ye) && yp0 < max(ys, ye)) {
        return 0;
    }

    // Check if it hits the start or the end of the line
    // yp1 = yp0 should have alrready been checked in a parent fn
    const ts = (ys - yp0) / (yp1 - yp0);
    const te = (ye - yp0) / (yp1 - yp0);

    // t is the min of ts and te within 0 - 1
    return min0To1(ts, te);
}

function timeAtMovingOverlap(xs0, ys0, xe0, ye0, xs1, ys1, xe1, ye1, xp0, yp0, xp1, yp1) {
    // Is it starting off intersecting?
    const xmin = min(xs0, xe0);
    const ymin = min(ys0, ye0);
    const xmax = max(xs0, xe0);
    const ymax = max(ys0, ye0);

    if (xmax - xmin > ymax - ymin ?
        xp0 > xmin && xp0 < xmax :
        yp0 > ymin && yp0 < ymax) {
        return 0;
    }

    // So when does it hit the start and end?
    const g = (yp1 - yp0) / (xp1 - xp0) ;

    const ts = (g > -1 && g < 1) ?
        (xs0 - xp0) / (xp1 - xp0 - xs1 + xs0) :
        (ys0 - yp0) / (yp1 - yp0 - ys1 + ys0) ;

    const te = (g > -1 && g < 1) ?
        (xe0 - xp0) / (xp1 - xp0 - xe1 + xe0) :
        (ye0 - yp0) / (yp1 - yp0 - ye1 + ye0) ;

    // And are they at times between 0 - 1?
    return min0To1(ts, te);
}

function detectMovingLineOverlap(xs0, ys0, xe0, ye0, xs1, ys1, xe1, ye1, xp0, yp0, xp1, yp1) {
    // Is it starting off intersecting?
    const t = timeAtMovingOverlap(xs0, ys0, xe0, ye0, xs1, ys1, xe1, ye1, xp0, yp0, xp1, yp1);

    // No intersect?
    if (t === undefined) { return; }

    return {
        t: t,
        point: Float64Array.of(
            t * (xp1 - xp0) + xp0,
            t * (yp1 - yp0) + yp0
        )
    };
}

function detectLineOverlap(xs, ys, xe, ye, xp0, yp0, xp1, yp1, g) {
    const t = (g > -1 && g < 1) ?
        timeAtOverlap(xs, xe, xp0, xp1) :
        timeAtOverlap(ys, ye, yp0, yp1) ;

    // No intersect?
    if (t === undefined) { return; }

    return {
        //fn: detectLineOverlap,
        //args: arguments,
        t: t,
        point: Float64Array.of(t * (xp1 - xp0) + xp0, t * (yp1 - yp0) + yp0)
    };
}

function detectXLine(x, ys, ye, xp0, yp0, xp1, yp1) {
    // It has at least some horizontal movement
    const t = (x - xp0) / (xp1 - xp0) ;

    // Intersect outside time window?
    if (t < 0 || t >= 1) {
        return;
    }

    const xpt = x;
    const ypt = t * (yp1 - yp0) + yp0;

    // Intersect outside line ends?
    return (ypt >= min(ys, ye) && ypt <= max(ys, ye)) ? {
            //fn: detectXLine,
            //args: arguments,
            t: t,
            point: Float64Array.of(xpt, ypt)
        } :
    undefined ;
}

function detectYLine(y, xs, xe, xp0, yp0, xp1, yp1) {
    // It has at least some vertical movement
    const t = (y - yp0) / (yp1 - yp0) ;

    // Intersect outside time window?
    if (t < 0 || t >= 1) {
        return;
    }

    const xpt = t * (xp1 - xp0) + xp0;
    const ypt = y;

    // Intersect outside line ends?
    return (xpt >= min(xs, xe) && xpt <= max(xs, xe)) ? {
            //fn: detectXLine,
            //args: arguments,
            t: t,
            point: Float64Array.of(xpt, ypt)
        } :
    undefined ;
}

function detectLine(xs, ys, xe, ye, xp0, yp0, xp1, yp1, g) {
    const t = (ys - yp0 + g * (xp0 - xs)) / (yp1 - yp0 + g * (xp0 - xp1));

    // Intersect outside time window?
    if (t < 0 || t >= 1) {
        return;
    }

    const xpt = t * (xp1 - xp0) + xp0;
    const ypt = t * (yp1 - yp0) + yp0;

    // Intersect outside line ends?
    if((g > -1 && g < 1) ?
        (xpt < min(xs, xe) || xpt > max(xs, xe)) :
        (ypt < min(ys, ye) || ypt > max(ys, ye))) {
        return;
    }

    return {
        //fn:    detectLine,
        //args:  arguments,
        t:  t,
        point: Float64Array.of(xpt, ypt)
    };
}

export function detectStaticLineMovingPoint(s, e, p0, p1) {
    const g  = gradient(s, e);
    const gp = gradient(p0, p1);
    const xs  = s[0];
    const ys  = s[1];
    const xe  = e[0];
    const ye  = e[1];
    const xp0 = p0[0];
    const yp0 = p0[1];
    const xp1 = p1[0];
    const yp1 = p1[1];

    // Are line and trajectory parallel?
    return g === gp ?
        // Are line and trajectory overlapping?
        g === gradient(s, p1) ?
            detectLineOverlap(xs, ys, xe, ye, xp0, yp0, xp1, yp1, g) :
        undefined :
    // Line is vertical
    g === Infinity ? detectXLine(xs, ys, ye, xp0, yp0, xp1, yp1) :
    // Line is horizontal
    g === 0 ? detectYLine(ys, xs, xe, xp0, yp0, xp1, yp1) :
    // Line is angled
    detectLine(xs, ys, xe, ye, xp0, yp0, xp1, yp1, g) ;
}

export function detectMovingLineMovingPoint(s0, e0, s1, e1, p0, p1) {
    const xs0 = s0[0];
    const ys0 = s0[1];
    const xe0 = e0[0];
    const ye0 = e0[1];
    const xs1 = s1[0];
    const ys1 = s1[1];
    const xe1 = e1[0];
    const ye1 = e1[1];
    const xp0 = p0[0];
    const yp0 = p0[1];
    const xp1 = p1[0];
    const yp1 = p1[1];

    const xa = xp1 - xp0 - xs1 + xs0;
    const ya = yp1 - yp0 - ys1 + ys0;
    const xb = xe1 - xe0 - xs1 + xs0;
    const yb = ye1 - ye0 - ys1 + ys0;

    const xps = xp0 - xs0;
    const yps = yp0 - ys0;
    const xes = xe0 - xs0;
    const yes = ye0 - ys0;

    // Quadratic around time at2 + bt + c = 0
    const a = ya * xb - yb * xa;
    const b = ya * xes + xb * yps - xa * yes - yb * xps;
    const c = yps * xes - xps * yes;

    //console.log('detectMovingLineMovingPoint', a, b, c);

    let t;

    // If a is 0 this is not a quadratic, it's just t = -c / b
    if (a === 0) {
        // If b is also 0 we have a problem. I think this means that p
        // is travelling parallel to the line.
        if (b === 0) {
            // And if c is 0 it is on the line
            if (c === 0) {
                return detectMovingLineOverlap(xs0, ys0, xe0, ye0, xs1, ys1, xe1, ye1, xp0, yp0, xp1, yp1);
            }

            undefined;
            //throw new Error('Fix this');
        }
        else {
            const ta = -c / b;
            t = ta >= 0 && ta < 1 ?
                ta :
                undefined;
        }
    }
    else {
        t = timeAtQuadratic(a, b, c);
    }

    if (t === undefined) {
        return;
    }

    const xpt = t * (xp1 - xp0) + xp0;
    const ypt = t * (yp1 - yp0) + yp0;
    const xst = t * (xs1 - xs0) + xs0;
    const yst = t * (ys1 - ys0) + ys0;
    const xet = t * (xe1 - xe0) + xe0;
    const yet = t * (ye1 - ye0) + ye0;

    // Intersect outside line ends?
    if (xpt < min(xst, xet) || xpt > max(xst, xet) || ypt < min(yst, yet) || ypt > max(yst, yet)) {
        return;
    }

    return {
        //fn: detectMovingLineMovingPoint,
        //args: arguments,
        t: t,
        point: Float64Array.of(xpt, ypt),
        st: Float64Array.of(xst, yst),
        et: Float64Array.of(xet, yet)
    };
}

export function detectLinePoint(s0, e0, s1, e1, p0, p1) {
    // Is line stationary?
    return equal(s0, s1) && equal(e0, e1) ?
        // Is point stationary too?
        equal(p0, p1) ?
            // Is line a single point?
            equal(s0, e0) ?
                // Does it coincide with point?
                equal(s0, p0) ? { t: 0, point: p0 } :
                undefined :
            // Is point in line?
            isPointInLine(s0, e0, p0) ?
                { t: 0, point: p0 } :
            undefined :
        // Does moving point cross static line?
        detectStaticLineMovingPoint(s0, e0, p0, p1) :
    // Does moving point cross moving line?
    detectMovingLineMovingPoint(s0, e0, s1, e1, p0, p1) ;
}


/*
window.d = detectLinePoint;

console.groupCollapsed('detectLinePoint(s0, e0, s1, e1, p0, p1)');

console.log('Vertical static line');

console.log(0.5,   detectLinePoint([1,0],[1,2],[1,0],[1,2],[0,1],[2,1]), 'Horizontal motion point');
console.log(0.5,   detectLinePoint([1,0],[1,2],[1,0],[1,2],[2,1],[0,1]), 'Horizontal inverse motion point');
console.log('und', detectLinePoint([1,0],[1,2],[1,0],[1,2],[0,3],[2,3]), 'Horizontal motion point out of bounds');
console.log(0,     detectLinePoint([1,0],[1,2],[1,0],[1,2],[1,1],[1,3]), 'Vertical line moving point (same trajectory)');
console.log(0.5,   detectLinePoint([1,0],[1,2],[1,0],[1,2],[1,3],[1,1]), 'Vertical inverse motion point (same trajectory)');
console.log('und', detectLinePoint([1,0],[1,2],[1,0],[1,2],[1,3],[1,5]), 'Vertical motion point out of bounds');
console.log(0,     detectLinePoint([1,0],[1,2],[1,0],[1,2],[1,1],[1,1]), 'Motionless point');
console.log('und', detectLinePoint([1,0],[1,2],[1,0],[1,2],[1,3],[1,3]), 'Motionless point out of bounds');

console.log('Horizontal static line');
console.log(0,     detectLinePoint([0,1],[2,1],[0,1],[2,1],[1,1],[3,1]), 'Horizontal line moving point (same trajectory)');
console.log(0.5,   detectLinePoint([0,1],[2,1],[0,1],[2,1],[3,1],[1,1]), 'Horizontal line moving point (same trajectory)');
console.log('und', detectLinePoint([0,1],[2,1],[0,1],[2,1],[3,1],[4,1]), 'Horizontal line point out of bounds');
console.log('und', detectLinePoint([0,1],[2,1],[0,1],[2,1],[0,2],[2,2]), 'Horizontal line point out of bounds');
console.log(0.5,   detectLinePoint([0,1],[2,1],[0,1],[2,1],[1,0],[1,2]), 'Vertical motion point');
console.log(0.5,   detectLinePoint([0,1],[2,1],[0,1],[2,1],[1,2],[1,0]), 'Vertical inverse motion point');
console.log('und', detectLinePoint([0,1],[2,1],[0,1],[2,1],[3,0],[3,2]), 'Vertical motion point out of bounds');
console.log(0,     detectLinePoint([0,1],[2,1],[0,1],[2,1],[1,1],[1,1]), 'Motionless point');
console.log('und', detectLinePoint([0,1],[2,1],[0,1],[2,1],[3,1],[3,1]), 'Motionless point out of bounds');

console.log('Angled static line');
console.log(0,     detectLinePoint([-2,-4],[2,4],[-2,-4],[2,4],[1,2],[3,6]), 'Angled line moving point (same trajectory)');
console.log(0.5,   detectLinePoint([-2,4],[2,-4],[-2,4],[2,-4],[3,-6],[1,-2]), 'Angled line moving point (same trajectory)');

console.log('Vertical travelling line');
console.log(0, detectLinePoint([0,0],[0,2],[2,0],[2,2],[0,1],[2,1]));
console.log(0.5,   detectLinePoint([0,0],[0,2],[2,0],[2,2],[1,0],[1,2]));
console.log(0.5,   detectLinePoint([0,0],[0,2],[2,0],[2,2],[1,1],[1,1]), 'Motionless point');
console.log(0.5,   detectLinePoint([0,0],[0,2],[2,0],[2,2],[2,1],[0,1]));
console.log(0.5,   detectLinePoint([0,0],[0,2],[2,0],[2,2],[1,2],[1,0]));
console.log(0.5,   detectLinePoint([0,0],[0,2],[2,0],[2,2],[1,1],[1,1]), 'Motionless point');

console.log('Horizontal travelling line');
console.log(0.5,   detectLinePoint([0,0],[2,0],[0,2],[2,2],[0,1],[2,1]));
console.log(0,     detectLinePoint([0,0],[2,0],[0,2],[2,2],[1,0],[1,2]));
console.log(0.5,   detectLinePoint([0,0],[2,0],[0,2],[2,2],[1,1],[1,1]), 'Motionless point');
console.log(0.5,   detectLinePoint([0,0],[2,0],[0,2],[2,2],[2,1],[0,1]));
console.log(0.5,   detectLinePoint([0,0],[2,0],[0,2],[2,2],[1,2],[1,0]));
console.log(0.5,   detectLinePoint([0,0],[2,0],[0,2],[2,2],[1,1],[1,1]), 'Motionless point');

console.log('/ to \\ travelling line');
console.log(0.5,   detectLinePoint([0,0],[2,2],[0,2],[2,0],[0,1],[2,1]));
console.log(0.5,   detectLinePoint([0,0],[2,2],[0,2],[2,0],[1,0],[1,2]));
console.log(0.5,   detectLinePoint([0,0],[2,2],[0,2],[2,0],[2,1],[2,1]), 'Motionless point');
console.log(0.5,   detectLinePoint([0,0],[2,2],[0,2],[2,0],[2,1],[0,1]));
console.log(0.5,   detectLinePoint([0,0],[2,2],[0,2],[2,0],[1,2],[1,0]));
console.log(0.5,   detectLinePoint([0,0],[2,2],[0,2],[2,0],[2,1],[2,1]), 'Motionless point');

console.log('\\ to / travelling line');
console.log(0.5,   detectLinePoint([0,2],[2,0],[0,0],[2,2],[0,1],[2,1]));
console.log(0.5,   detectLinePoint([0,2],[2,0],[0,0],[2,2],[1,0],[1,2]));
console.log(0.5,   detectLinePoint([0,2],[2,0],[0,0],[2,2],[2,1],[2,1]), 'Motionless point');
console.log(0.5,   detectLinePoint([0,2],[2,0],[0,0],[2,2],[2,1],[0,1]));
console.log(0.5,   detectLinePoint([0,2],[2,0],[0,0],[2,2],[1,2],[1,0]));
console.log(0.5,   detectLinePoint([0,2],[2,0],[0,0],[2,2],[2,1],[2,1]), 'Motionless point');

console.log('Point outside the line');
console.log('und',   detectLinePoint([0,2],[2,0],[0,0],[2,2],[0,3],[2,3]));
console.log('und',   detectLinePoint([0,2],[2,0],[0,0],[2,2],[3,0],[3,2]));
console.log('und',   detectLinePoint([0,2],[2,0],[0,0],[2,2],[2,3],[0,3]));
console.log('und',   detectLinePoint([0,2],[2,0],[0,0],[2,2],[3,2],[3,0]));

console.groupEnd();
*/


function detectObjectPoint(shape0, shape1, p0, p1) {
    if (shape0.length !== shape1.length) {
        throw new Error('shape0 and shape1 must have equal length');
    }

    let n = shape0.length - 1;
    let t = Infinity;
    let collision;

    while(n--) {
        const c = detectLinePoint(shape0[n], shape0[n + 1], shape1[n], shape1[n + 1], p0, p1);

        if (c && c.t < t) {
            t = c.t;
            collision = c;
            collision.s0 = shape0[n];
            collision.e0 = shape0[n + 1];
            collision.s1 = shape1[n];
            collision.e1 = shape1[n + 1];
            collision.p0 = p0;
            collision.p1 = p1;
        }
    }
}

function detectObjectObject(shapeA0, shapeA1, shapeB0, shapeB1) {
    if (shapeB0.length !== shapeB1.length) {
        throw new Error('shape0 and shape1 must have equal length');
    }

    let n = shapeB0.length;
    let t = Infinity;
    let collision;

    while(n--) {
        const c = detectObjectPoint(shapeA0, shapeA1, shapeB0[n], shapeB1[n]);

        if (c && c.t < t) {
            t = c.t;
            collision = c;
        }
    }

    n = shapeA0.length;

    while(n--) {
        const c = detectObjectPoint(shapeB0, shapeB1, shapeA0[n], shapeA1[n]);

        if (c && c.t < t) {
            t = c.t;
            collision = c;
        }
    }

    return collision;
}



export function detectCirclePoint(c0, r0, c1, r1, p0, p1) {
    const xc0 = c0[0];
    const yc0 = c0[1];
    const xc1 = c1[0];
    const yc1 = c1[1];
    const xp0 = p0[0];
    const yp0 = p0[1];
    const xp1 = p1[0];
    const yp1 = p1[1];

    const xp = xp1 - xp0;
    const yp = yp1 - yp0;
    const xc = xc1 - xc0;
    const yc = yc1 - yc0;
    const r  = r1 - r0;

    const xpc  = xp - xc;
    const ypc  = yp - yc;
    const xpc0 = xp0 - xc0;
    const ypc0 = yp0 - yc0;

    // Quadratic around time at2 + bt + c = 0
    const a = xpc * xpc + ypc * ypc - r * r;
    const b = 2 * (xpc * xpc0 + ypc * ypc0 - r * r0);
    const c = xpc0 * xpc0 + ypc0 * ypc0 - r0 * r0;
    const t = timeAtQuadratic(a, b, c);

    if (t === undefined) {
        return;
    }
    else if (t === 0) {
        return {
            //fn: detectCirclePoint,
            //args: arguments,
            t: 0,
            point: p0,
            objectA: {
                c: c0,
                r: r0
            }
        };
    }

    const xpt = t * (xp1 - xp0) + xp0;
    const ypt = t * (yp1 - yp0) + yp0;
    const xct = t * (xc1 - xc0) + xc0;
    const yct = t * (yc1 - yc0) + yc0;
    const rt  = t * (r1  - r0)  + r0;

    // Intersect outside line ends?
    // Todo: here we must do something with arc start and arc stop to find out
    // whether the collision was within the limits of the arc
    //if (xpt < min(xst, xet) || xpt > max(xst, xet) || ypt < min(yst, yet) || ypt > max(yst, yet)) {
    //    return;
    //}

    return {
        //fn: detectMovingLineMovingPoint,
        //args: arguments,
        t: t,
        point: Float64Array.of(xpt, ypt),
        objectA: {
            c: Float64Array.of(xct, yct),
            r: rt,
            // Angle start angle end
        }
    };
}

export function detectCircleCircle(ca0, ra0, ca1, ra1, cb0, rb0, cb1, rb1) {
    const xa0 = ca0[0];
    const ya0 = ca0[1];
    const xa1 = ca1[0];
    const ya1 = ca1[1];
    const xb0 = cb0[0];
    const yb0 = cb0[1];
    const xb1 = cb1[0];
    const yb1 = cb1[1];

    const xa   = xa1 - xa0;
    const xb   = xb1 - xb0;
    const xba  = xb - xa
    const xba0 = xb0 - xa0;
    const ya   = ya1 - ya0;
    const yb   = yb1 - yb0;
    const yba  = yb - ya;
    const yba0 = yb0 - ya0;

    // Test if one circle is inside the other at the start, if so we are
    // looking for interior collision detection.
    const inside = pow(xba0 * xba0 + yba0 * yba0, 0.5) < max(abs(ra0), abs(rb0)) ;
    const ra   = ra1 - ra0;
    const rb   = rb1 - rb0;
    const rab  = inside ? rb - ra : rb + ra ;
    const rab0 = inside ? rb0 - ra0 : rb0 + ra0 ;

    // Quadratic around time at2 + bt + c = 0
    const a = xba * xba + yba * yba - rab * rab;
    const b = 2 * (xba * xba0 + yba * yba0 - rab * rab0);
    const c = xba0 * xba0 + yba0 * yba0 - rab0 * rab0;
    const t = timeAtQuadratic(a, b, c);

    if (t === undefined) {
        return;
    }
    else if (t === 0) {
        const ratio = rb0 / ra0;
        const xt = ratio * (xb0 - xa0) + xa0;
        const yt = ratio * (yb0 - ya0) + ya0;

        return {
            //fn: detectCircleCircle,
            //args: arguments,
            t: 0,

            point: Float64Array.of(xt, yt),

            objectA: {
                c: ca0,
                r: ra0
            },

            objectB: {
                c: cb0,
                r: rb0
            }
        };
    }

    //console.log(t, xa0, ya0, ra0, xa1, ya1, ra1, xb0, yb0, rb0, xb1, yb1, rb1);
    const xat = t * (xa1 - xa0) + xa0;
    const yat = t * (ya1 - ya0) + ya0;
    const xbt = t * (xb1 - xb0) + xb0;
    const ybt = t * (yb1 - yb0) + yb0;
    const rat = t * (ra1 - ra0) + ra0;
    const rbt = t * (rb1 - rb0) + rb0;
    const ratio = rbt / rat;
    const xt = ratio * (xbt - xat) + xat;
    const yt = ratio * (ybt - yat) + yat;

    // Intersect outside line ends?
    // Todo: here we must do something with arc start and arc stop to find out
    // whether the collision was within the limits of the arc
    //if (xpt < min(xst, xet) || xpt > max(xst, xet) || ypt < min(yst, yet) || ypt > max(yst, yet)) {
    //    return;
    //}

    return {
        //fn: detectCircleCircle,
        //args: arguments,
        t: t,
        point: Float64Array.of(xt, yt),
        objectA: {
            c: Float64Array.of(xat, yat),
            r: rat
        },
        objectB: {
            c: Float64Array.of(xbt, ybt),
            r: rbt
        }
    };
}

const createBoxCircleCollision = choose({
    0: function xmin(t, box, c0, c1) {
        const y0 = c0[1];
        const y1 = c1[1];

        return {
            t: t,
            point: Float64Array.of(box[0], t * (y1 - y0) + y0)
        };
    },

    1: function xmax(t, box, c0, c1) {
        const y0 = c0[1];
        const y1 = c1[1];

        return {
            t: t,
            point: Float64Array.of(box[0] + box[2], t * (y1 - y0) + y0)
        };
    },

    2: function ymin(t, box, c0, c1) {
        const x0 = c0[0];
        const x1 = c1[0];

        return {
            t: t,
            point: Float64Array.of(t * (x1 - x0) + x0, box[1])
        };
    },

    3: function ymax(t, box, c0, c1) {
        const x0 = c0[0];
        const x1 = c1[0];

        return {
            t: t,
            point: Float64Array.of(t * (x1 - x0) + x0, box[1] + box[3])
        };
    }
});

export function detectBoxCircle(box, c0, r0, c1, r1) {
    // Detects circles colliding with the interior of a box (for just now -
    // exteriors later)

    const x0 = c0[0];
    const y0 = c0[1];
    const x1 = c1[0];
    const y1 = c1[1];

    const xmin  = box[0];
    const xmax  = box[0] + box[2];
    const ymin  = box[1];
    const ymax  = box[1] + box[3];

    const times = [
        (xmin - x0 + r0) / ((x1 - r1) - (x0 - r0)),
        (xmax - x0 - r0) / ((x1 + r1) - (x0 + r0)),
        (ymin - y0 + r0) / ((y1 - r1) - (y0 - r0)),
        (ymax - y0 - r0) / ((y1 + r1) - (y0 + r0))
    ];

    const t = times.reduce(min0To1);

//console.log('>', t);

    if (t === undefined) {
        return;
    }

    const i = times.indexOf(t);

//console.log(t, x0, y0, x1, y1, xmin, xmax, ymin, ymax);

    return createBoxCircleCollision(i, t, box, c0, c1);
}


/*
console.group('detectCirclePoint(c0, r0, c1, r1, p0, p1)');

console.log('Static circle');
console.log(1/3, detectCirclePoint([2,0], 1, [2,0], 1, [2,-3], [2,3]),          'Intersecting point going up');
console.log(1/3, detectCirclePoint([2,0], 1, [2,0], 1, [-1,0], [5,0]),          'Intersecting point going right');
console.log(0.4, detectCirclePoint([2,0], 1, [2,0], 1, [-1,-4], [5,4]),         'Intersecting point going up right');
console.log(0.5, detectCirclePoint([2,0], 1, [2,0], 1, [3,-3], [3,3]),          'Tangent point going up');
console.log(0.5, detectCirclePoint([2,0], 1, [2,0], 1, [-1,-1], [5,-1]),        'Tangent point going right');
console.log(0.5, detectCirclePoint([2,0], 1, [2,0], 1, [-1,-5], [5,3]),         'Tangent point going up right');
console.log(undefined, detectCirclePoint([2,0], 1, [2,0], 1, [4,-3], [4,3]),    'Miss point going up');
console.log(undefined, detectCirclePoint([2,0], 1, [2,0], 1, [-1,-2], [5,-2]),  'Miss point going right');
console.log(undefined, detectCirclePoint([2,0], 1, [2,0], 1, [-1,-6], [5,2]),   'Miss point going up right');

console.log('Growing radius circle');
console.log(0.5, detectCirclePoint([0,0], 1, [0,0], 3, [0,-4], [0,0]),          'Growing radius and intersecting point going up');
console.log(0.5, detectCirclePoint([0,0], 1, [0,0], 3, [-4,0], [0,0]),          'Growing radius and intersecting point going right');
console.log(0.5, detectCirclePoint([0,0], 1, [0,0], 3, [-4,-2], [0,2]),         'Growing radius and intersecting point going up right');
console.log(0,   detectCirclePoint([0,0], 1, [0,0], 3, [1,0], [3,0]),           'Growing radius and constantly intersecting point going right');

console.log('Moving circle');
console.log(0.4, detectCirclePoint([-4,-3], 1, [4,3], 1, [0,0], [0,0]),         'Intersecting stationery point');
console.log(0.5, detectCirclePoint([-4,-4], 1, [4,2], 1, [0,0], [0,0]),         'Tangent stationery point');
console.log(0.5, detectCirclePoint([-4,-4], 1, [4,2], 1, [6,2], [-6,-2]),       'Intersecting point going down left');
console.log(undefined, detectCirclePoint([-4,-5], 1, [4,1], 1, [6,2], [-6,-2]), 'Miss point going down left');

console.log('Moving circle growing radius');
console.log(0.5, detectCirclePoint([-4,0], 1, [2,0], 3, [1,0], [1,0]),          'Intersecting stationery point');
console.log(0.5, detectCirclePoint([-4,-5], 1, [4,1], 3, [0,0], [0,0]),         'Tangent stationery point');
console.log(0.5, detectCirclePoint([-4,0], 1, [2,0], 3, [6,0], [-4,0]),         'Intersecting point moving left');
console.log(0.5, detectCirclePoint([-4,-5], 1, [4,1], 3, [6,6], [-6,-6]),       'Tangent point moving down left');

console.groupEnd();
*/

console.groupCollapsed('detectCircleCircle(ca0, ra0, ca1, ra1, cb0, rb0, cb1, rb1)');

console.log('Static circle');
console.log(0,   detectCircleCircle([2,0], 1, [2,0], 1, [2,0], 1, [2,0], 1),  'Same circle');
console.log(0,   detectCircleCircle([2,0], 1, [2,0], 1, [4,0], 1, [4,0], 1),        'Static circle');
console.log(0.5, detectCircleCircle([2,0], 1, [2,0], 1, [5,0], 1, [3,0], 1),        'Moving circle');
console.log(1/3, detectCircleCircle([2,0], 1, [2,0], 1, [5,0], 1, [3,0], 2),        'Moving circle, growing radius');

console.log('Moving circle');
console.log(0.25, detectCircleCircle([2,1], 1, [4,5], 1, [2,5], 1, [4,1], 1),       'Moving circle');
console.log(0.2, detectCircleCircle([2,0], 1, [4,6], 1, [2,6], 3, [4,0], 1),       'Moving circle, growing radius');

console.log(detectCircleCircle([93.66666666666669, 93.66666666666669, 20], 20, [93.33333333333336, 93.33333333333336, 20], 20, [58.166666666666615, 58.166666666666615, 30], 30, [58.33333333333328, 58.33333333333328, 30], 30));

/*
console.log(1/3, detectCircleCircle([2,0], 1, [2,0], 1, [-1,0], [5,0]),          'Intersecting point going right');
console.log(0.4, detectCircleCircle([2,0], 1, [2,0], 1, [-1,-4], [5,4]),         'Intersecting point going up right');
console.log(0.5, detectCircleCircle([2,0], 1, [2,0], 1, [3,-3], [3,3]),          'Tangent point going up');
console.log(0.5, detectCircleCircle([2,0], 1, [2,0], 1, [-1,-1], [5,-1]),        'Tangent point going right');
console.log(0.5, detectCircleCircle([2,0], 1, [2,0], 1, [-1,-5], [5,3]),         'Tangent point going up right');
console.log(undefined, detectCircleCircle([2,0], 1, [2,0], 1, [4,-3], [4,3]),    'Miss point going up');
console.log(undefined, detectCircleCircle([2,0], 1, [2,0], 1, [-1,-2], [5,-2]),  'Miss point going right');
console.log(undefined, detectCircleCircle([2,0], 1, [2,0], 1, [-1,-6], [5,2]),   'Miss point going up right');

console.log('Growing radius circle');
console.log(0.5, detectCircleCircle([0,0], 1, [0,0], 3, [0,-4], [0,0]),          'Growing radius and intersecting point going up');
console.log(0.5, detectCircleCircle([0,0], 1, [0,0], 3, [-4,0], [0,0]),          'Growing radius and intersecting point going right');
console.log(0.5, detectCircleCircle([0,0], 1, [0,0], 3, [-4,-2], [0,2]),         'Growing radius and intersecting point going up right');
console.log(0,   detectCircleCircle([0,0], 1, [0,0], 3, [1,0], [3,0]),           'Growing radius and constantly intersecting point going right');

console.log('Moving circle');
console.log(0.4, detectCircleCircle([-4,-3], 1, [4,3], 1, [0,0], [0,0]),         'Intersecting stationery point');
console.log(0.5, detectCircleCircle([-4,-4], 1, [4,2], 1, [0,0], [0,0]),         'Tangent stationery point');
console.log(0.5, detectCircleCircle([-4,-4], 1, [4,2], 1, [6,2], [-6,-2]),       'Intersecting point going down left');
console.log(undefined, detectCircleCircle([-4,-5], 1, [4,1], 1, [6,2], [-6,-2]), 'Miss point going down left');

console.log('Moving circle growing radius');
console.log(0.5, detectCircleCircle([-4,0], 1, [2,0], 3, [1,0], [1,0]),          'Intersecting stationery point');
console.log(0.5, detectCircleCircle([-4,-5], 1, [4,1], 3, [0,0], [0,0]),         'Tangent stationery point');
console.log(0.5, detectCircleCircle([-4,0], 1, [2,0], 3, [6,0], [-4,0]),         'Intersecting point moving left');
console.log(0.5, detectCircleCircle([-4,-5], 1, [4,1], 3, [6,6], [-6,-6]),       'Tangent point moving down left');
*/
console.groupEnd();
