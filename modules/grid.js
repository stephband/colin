
/* Terrain */

import { drawPath } from './canvas.js';

const x0 = [
    [0, -1000],
    [0, 1000]
];

const y0 = [
    [-1000, 0],
    [1000, 0]
];

export function render(ctx, viewbox, style) {
    ctx.strokeStyle = '#000000cc';
    drawPath(ctx, [
        [viewbox[0], 0],
        [viewbox[0] + viewbox[2], 0]
    ]);
    ctx.stroke();
    drawPath(ctx, [
        [0, viewbox[1]],
        [0, viewbox[1] + viewbox[3]]
    ]);
    ctx.stroke();
}
