
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

export function drawCircle(ctx, center, radius) {
    ctx.beginPath();
    ctx.arc(center[0], center[1], radius, 0, Math.PI * 2, true);
    ctx.closePath();
}
