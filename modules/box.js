import { get, last } from '../../fn/module.js';
import { drawPath } from './canvas.js';

export function of(x, y, w, h) {
    return {
        type: 'box',
        data: Float64Array.from(arguments)
    };
}

const object1 = {};

export function update(t0, t1, box) {
    //object1.position = updateValue(ball.position, t1 - t0);
    return object1;
}

export function render(ctx, viewbox, style, box) {
    ctx.save();
    ctx.beginPath();
    ctx.rect.apply(ctx, box.data);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.restore();
}
