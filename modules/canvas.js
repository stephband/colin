
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

export function drawCircle(ctx, data) {
    ctx.beginPath();
    ctx.arc(data[0], data[1], data[2], 0, Math.PI * 2, true);
    ctx.closePath();
}

export function drawLines(ctx, points) {
    if (points.length < 4) {
        throw new Error('points must contain at least two coordinates (length 4)')
    }

    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);

    let n = 2;
    while (n < points.length) {
        ctx.lineTo(points[n], points[n + 1]);
        n += 2;
    }

    ctx.closePath();
}
