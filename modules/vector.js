
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
