
import { choose } from '../../fn/module.js';
import { equal, gradient } from './vector.js';
import { detect } from './detect.js';

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



