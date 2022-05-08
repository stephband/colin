
const turn = 2 * Math.PI;

function lineTo(ctx, point) {
    ctx.lineTo(point[0], point[1]);
    return ctx;
}

export function drawPath(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    points
    .reduce(lineTo, ctx)
    .closePath();
}

export function drawLine(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    ctx.lineTo(points[2], points[3]);
    ctx.closePath();
}

export function drawCircle(ctx, data) {
    ctx.beginPath();
    ctx.arc(data[0], data[1], data[2], 0, turn, true);
    ctx.closePath();
}

export function drawPolygon(ctx, data) {
    if (data.length < 4) {
        throw new Error('data must contain at least two coordinates (length 4)')
    }

    ctx.beginPath();
    ctx.moveTo(data[0], data[1]);

    let n = 0;
    while ((n += 2) < data.length) {
        ctx.lineTo(data[n], data[n + 1]);
    }

    ctx.closePath();
}

// Support old fn name
export const drawLines = drawPolygon;
