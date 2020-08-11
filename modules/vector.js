
export function copy(vector) {
    return Float64Array.of(
        vector[0],
        vector[1]
    );
}

export function mag(v) {
    // Magnitude of vector
    return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

export function angle(v) {
    // Angle with the x axis
    return Math.atan2(v[1], v[0]);
}

export function multiply(n, vector) {
    return typeof n == 'number' ? Float64Array.of(
        vector[0] * n,
        vector[1] * n
    ) : Float64Array.of(
        vector[0] * n[0],
        vector[1] * n[1]
    );
}

export function subtract(n, vector) {
    return typeof n == 'number' ? Float64Array.of(
        vector[0] - n,
        vector[1] - n
     ) : Float64Array.of(
        vector[0] - n[0],
        vector[1] - n[1]
     );
}

export function add(n, vector) {
    return typeof n == 'number' ? Float64Array.of(
        vector[0] + n,
        vector[1] + n
     ) : Float64Array.of(
        vector[0] + n[0],
        vector[1] + n[1]
     );
}

export function gradient(v0, v1) {
    const g = (v1[1] - v0[1]) / (v1[0] - v0[0]);
    // Catch -Infinity and represent it as Infinity (there should be one
    // possible value for each gradient)
    return g === -Infinity ?
        Infinity :
        g ;
}

export function equal(v0, v1) {
    return v0[0] === v1[0] && v0[1] === v1[1];
}


/* Centroid of polygon */

function reduceLines(fn, total, data) {
    const n1 = data.length - 2;

    var n = 0;
    var total = 0;

    while(n < n1) {
        total = fn(total, data[n], data[n + 1], data[n + 2], data[n + 3]);
        n += 2;
    }

    // Is it not a closed path? add the final line
    if (data[n] !== data[0] && data[n + 1] !== data[1]) {
        total = fn(total, data[n], data[n + 1], data[0], data[1]);
    }

    return total;
}

const centroidTotals = {
    asum:  0,
    cxsum: 0,
    cysum: 0
};

function toCentroidTotals(totals, x0, y0, x1, y1) {
    totals.asum  += x0 * y1 - x1 * y0;
    totals.cxsum += (x0 + x1) * (x0 * y1 - x1 * y0);
    totals.cysum += (y0 + y1) * (x0 * y1 - x1 * y0);
    return totals;
}

export function centroid(data) {
    // From "Of a polygon":
    // https://en.wikipedia.org/wiki/Centroid#Centroid_of_polygon

    centroidTotals.asum  = 0;
    centroidTotals.cxsum = 0;
    centroidTotals.cysum = 0;

    const { asum, cxsum, cysum } = reduceLines(toCentroidTotals, centroidTotals, data);

    const cx = cxsum / (3 * asum);
    const cy = cysum / (3 * asum);

    return Float64Array.of(cx, cy);
}
