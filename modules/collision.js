
const abs = Math.abs;
const max = Math.max;
const min = Math.min;
const pow = Math.pow;

function isPointInLine(xs, ys, xe, ye, xp, yp) {
    const g = (ye - ys) / (xe - xs);

    // Return true where point is inside line bounds and p is
    // the same gradient from s as e is...
    return ((g > -1 && g < 1) ?
        xp >= min(xs, xe) && xp <= max(xs, xe) :
        yp >= min(ys, ye) && yp <= max(ys, ye))
    && g === ((yp - ys) / (xp - xs)) ;
}

function timeAtPoint(x0, y0, x1, y1, xp, yp) {
    const g = (y1 - y0) / (x1 - x0);

    // Return true where point is inside line bounds and p is
    // the same gradient from s as e is...
    return (g > -1 && g < 1) ?
        (xp - x0) / (x1 - x0) :
        (yp - y0) / (y1 - y0) ;
}

function min0To1(a, b) {
    // Get the min of a and b in the range 0 > n >= 1
    return a > 0 && a <= 1 ?
        b > 0 && b <= 1 ?
            min(a, b) :
            a :
        b > 0 && b <= 1 ?
            b :
            undefined ;
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

function timeAtMovingLineOverlap(xs0, ys0, xe0, ye0, xs1, ys1, xe1, ye1, xp0, yp0, xp1, yp1) {
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
    const t = timeAtMovingLineOverlap(xs0, ys0, xe0, ye0, xs1, ys1, xe1, ye1, xp0, yp0, xp1, yp1);

    // No intersect?
    if (t === undefined) { return; }

    return Float64Array.of(
        t,
        t * (xp1 - xp0) + xp0,
        t * (yp1 - yp0) + yp0
    );
}

function intersectionXLine(x, xs, ys, xe, ye) {
    const ratio = (x - xs) / (xe - xs);
    const y = ratio * (ye - ys) + ys;
    return Float64Array.of(x, y);
}

function intersectionLineLine(xas, yas, xae, yae, xbs, ybs, xbe, ybe) {
    if (xas === xae) {
        // Line is vertical
        if (xbs === xbe) {
            // So is other line!
            return;
        }

        return intersectionXLine(xas, xbs, ybs, xbe, ybe);
    }

    if (xbs === xbe) {
        return intersectionXLine(xbs, xas, yas, xae, yae);
    }

    // y = ma x + ca
    // y = mb x + cb
    let ma = (yae - yas) / (xae - xas);
    let mb = (ybe - ybs) / (xbe - xbs);
    ma = ma === -Infinity ? Infinity : ma ;
    mb = mb === -Infinity ? Infinity : mb ;

    const ca = ma === Infinity ?
        0 :
        yas - ma * xas ;

    const cb = mb === Infinity ?
        0 :
        ybs - mb * xbs ;

    // Are lines parallel?
    if (ma === mb) {
        // Are lines overlaps?
        if (ca === cb) {
            console.log('Hmmmmmm. do somthing about this')
            return Float64Array.of(xas, yas);
        }

        return undefined;
    }

    const x = (cb - ca) / (ma - mb);
    const y = (mb * ca - ma * cb) / (mb - ma);

    return Float64Array.of(x, y);
}

function nearestPointOnLine(xs, ys, xe, ye, xp, yp) {
    // From The Closest Point on a Line to a Point Algorithm, here:
    // https://ericleong.me/research/circle-line/

    const a  = ye - ys;
    const b  = xs - xe;
    const c1 = a * xs + b * ys;
    const c2 = a * yp - b * xp;
    const d  = a * a + b * b;

    // Is point on the line`?
    if (d === 0) {
        return Float64Array.of(xp, yp);
    }

    const x = (a * c1 - b * c2) / d;
    const y = (a * c2 + b * c1) / d;

    return Float64Array.of(x, y);
}

function staticLineMovingRadius() {

}


export function detectStaticLineMovingCircle(xs, ys, xe, ye, xc0, yc0, r0, xc1, yc1, r1) {
    // The closest point on the line to the circle center start
    const l0 = nearestPointOnLine(xs, ys, xe, ye, xc0, yc0);
    const xv0 = l0[0] - xc0;
    const yv0 = l0[1] - yc0;

    // Is it starting inside the radius? Dont count as collision -
    // a collision is an event not a continuous state. Because nearestPointOnLine
    // does not test line limits, this includes circles starting beyond
    // line limits, but that means the circle can only hit the ends, and
    // they should be picked up by point-circle detection on the endpoints
    if (xv0 * xv0 + yv0 * yv0 < r0 * r0) {
        return;
    }

    // The point of intersection between line and circle center
    const a = intersectionLineLine(xs, ys, xe, ye, xc0, yc0, xc1, yc1);

    // Is line and movement parallel?
    if (!a) {
        return staticLineMovingRadius(xs, ys, xe, ye, xc0, yc0, r0, xc1, yc1, r1);
    }

    // The closest point on the line to the circle center end
    //const l1 = nearestPointOnLine(xs, ys, xe, ye, xc1, yc1);
    // The closest point on the movement vector to line start
    //const c = nearestPointOnLine(xc0, yc0, xc1, yc1, xs, ys);
    // The closest point on the movement vector to line end
    //const d = nearestPointOnLine(xc0, yc0, xc1, yc1, xe, ye);

    // Now there's a bunch of conditions in here which I need to do...

    // I don't understand the way he does it, I'm doing it the stupid way
    const m = pow(xv0 * xv0 + yv0 * yv0, 0.5);
    const ratio = r0 / m;
    const xct = a[0] - ratio * (a[0] - xc0);
    const yct = a[1] - ratio * (a[1] - yc0);

    const t          = timeAtPoint(xc0, yc0, xc1, yc1, xct, yct);
    const [xpt, ypt] = nearestPointOnLine(xs, ys, xe, ye, xct, yct);

    const g = (ye - ys) / (xe - xs);

    // Is point inside line (not including the actual points at the ends,
    // as they are tested separately) TODO: this is philosophical: we are
    // sure of this reasoning?
    const isWithinLineBounds = (g > -1 && g < 1) ?
        xpt > min(xs, xe) && xpt < max(xs, xe) :
        ypt > min(ys, ye) && ypt < max(ys, ye) ;

    if (!isWithinLineBounds) {
        return;
    }

    // Return t, x, y and object data xct, yct, r0
    return Float64Array.of(t, xpt, ypt, xct, yct, r0);
}

export function detectStaticLineMovingPoint(xs, ys, xe, ye, xp0, yp0, xp1, yp1) {
    const g  = (ye - ys) / (xe - xs) ;
    const gp = (yp1 - yp0) / (xp1 - xp0);

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

export function detectMovingLineMovingPoint(xs0, ys0, xe0, ye0, xs1, ys1, xe1, ye1, xp0, yp0, xp1, yp1) {
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

    return Float64Array.of(t, xpt, ypt);
}

export function detectLinePoint(xs0, ys0, xe0, ye0, xs1, ys1, xe1, ye1, xp0, yp0, xp1, yp1) {
    // Is line stationary?
    return xs0 === xs1 && ys0 === ys1 && xe0 === xe1 && ye0 === ye1 ?
        // Is point stationary too?
        xp0 === xp1 && yp0 === yp1 ?
            // Is line a single point?
            xs0 === xe0 && ys0 === ye0 ?
                // Does it coincide with point?
                xs0 === xp0 && ys0 === yp0 ?
                    Float64Array.of(0, xp0, yp0) :
                undefined :
            // Is point in line?
            isPointInLine(xs0, ys0, xe0, ye0, xp0, yp0) ?
                Float64Array.of(0, xp0, yp0) :
            undefined :
        // Does moving point cross static line?
        detectStaticLineMovingPoint(xs0, ys0, xe0, ye0, xp0, yp0, xp1, yp1) :
    // Does moving point cross moving line?
    detectMovingLineMovingPoint(xs0, ys0, xe0, ye0, xs1, ys1, xe1, ye1, xp0, yp0, xp1, yp1) ;
}

export function detectCirclePoint(xc0, yc0, r0, xc1, yc1, r1, xp0, yp0, xp1, yp1) {
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

    if (t === 0) {
        return Float64Array.of(t, xp0, yp0);
    }

    const xpt = t * (xp1 - xp0) + xp0;
    const ypt = t * (yp1 - yp0) + yp0;

    // Intersect outside line ends?
    // Todo: here we must do something with arc start and arc stop to find out
    // whether the collision was within the limits of the arc
    //if (xpt < min(xst, xet) || xpt > max(xst, xet) || ypt < min(yst, yet) || ypt > max(yst, yet)) {
    //    return;
    //}

    return Float64Array.of(t, xpt, ypt);
}

const Buffer = (function(buffer) {
    return function collision(t, xp, yp, xa, ya, ra, xb, yb, rb) {
        buffer[0] = t;
        buffer[1] = xp;
        buffer[2] = yp;
        buffer[3] = xa;
        buffer[4] = ya;
        buffer[5] = ra;
        buffer[6] = xb;
        buffer[7] = yb;
        buffer[8] = rb;
        return buffer;
    }
})(new Float64Array(9));

export function detectCircleCircle(xa0, ya0, ra0, xa1, ya1, ra1, xb0, yb0, rb0, xb1, yb1, rb1) {
    const xa   = xa1 - xa0;
    const xb   = xb1 - xb0;
    const xba  = xb - xa;
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

    if (!t) {
        return;
    }

    /*
    if (t === 0) {
        const ratio = rb0 / ra0;
        const xt = ratio * (xb0 - xa0) + xa0;
        const yt = ratio * (yb0 - ya0) + ya0;
        return Float64Array.of(t, xt, yt);
    }
    */

    //console.log(t, xa0, ya0, ra0, xa1, ya1, ra1, xb0, yb0, rb0, xb1, yb1, rb1);
    const xat = t * (xa1 - xa0) + xa0;
    const yat = t * (ya1 - ya0) + ya0;
    const xbt = t * (xb1 - xb0) + xb0;
    const ybt = t * (yb1 - yb0) + yb0;
    const rat = t * (ra1 - ra0) + ra0;
    const rbt = t * (rb1 - rb0) + rb0;
    const ratio = rat / rbt;
    const xt = ratio * (xbt - xat) + xat;
    const yt = ratio * (ybt - yat) + yat;

    // Time, xp, yp, xa, ya, ra, xb, yb, rb
    return Buffer(t, xt, yt, xat, yat, rat, xbt, ybt, rbt);
}

const boxCircleCollisions = {
    0: function xmin(t, bx, by, bw, bh, x0, y0, r0, x1, y1, r1) {
        const xp = bx;
        const yp = t * (y1 - y0) + y0;
        const rb = t * (r1 - r0) + r0;
        const xb = xp + rb;
        // Time, xp, yp, xa, ya, ra, xb, yb, rb
        return Buffer(t, xp, yp, bx, by, 0, xb, yp, rb);
    },

    1: function xmax(t, bx, by, bw, bh, x0, y0, r0, x1, y1, r1) {
        const xp = bx + bw;
        const yp = t * (y1 - y0) + y0;
        const rb = t * (r1 - r0) + r0;
        const xb = xp - rb;
        // Time, xp, yp, xa, ya, ra, xb, yb, rb
        return Buffer(t, xp, yp, bx, by, 0, xb, yp, rb);
    },

    2: function ymin(t, bx, by, bw, bh, x0, y0, r0, x1, y1, r1) {
        const xp = t * (x1 - x0) + x0;
        const yp = by;
        const rb = t * (r1 - r0) + r0;
        const yb = yp + rb;
        // Time, xp, yp, xa, ya, ra, xb, yb, rb
        return Buffer(t, xp, yp, bx, by, 0, xp, yb, rb);
    },

    3: function ymax(t, bx, by, bw, bh, x0, y0, r0, x1, y1, r1) {
        const xp = t * (x1 - x0) + x0;
        const yp = by + bh;
        const rb = t * (r1 - r0) + r0;
        const yb = yp - rb;        
        // Time, xp, yp, xa, ya, ra, xb, yb, rb
        return Buffer(t, xp, yp, bx, by, 0, xp, yb, rb);
    }
};

const returns = [];

export function detectBoxCircle(bx, by, bw, bh, x0, y0, r0, x1, y1, r1) {
    // Detects circles colliding with the interior of a box (for just now -
    // exteriors later)
    const xmin  = bx;
    const xmax  = bx + bw;
    const ymin  = by;
    const ymax  = by + bh;

    const times = [
        (xmin - x0 + r0) / ((x1 - r1) - (x0 - r0)),
        (xmax - x0 - r0) / ((x1 + r1) - (x0 + r0)),
        (ymin - y0 + r0) / ((y1 - r1) - (y0 - r0)),
        (ymax - y0 - r0) / ((y1 + r1) - (y0 + r0))
    ];

    const t = times.reduce(min0To1);

    if (t === undefined) {
        return;
    }

    var i = times.length;
    returns.length = 0;
    while (i--) {
        if (t === times[i]) {
            returns.push.apply(returns, boxCircleCollisions[i](t, bx, by, bw, bh, x0, y0, r0, x1, y1, r1));
        }
    }

    return returns;
}
