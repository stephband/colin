

import { deep, id, overload } from '../../fn/module.js';
import { drawCircle } from './canvas.js';

const assign = Object.assign;

/* Ball */

export function create(radius, x = 0, y = 0, vx = 0, vy = 0, color) {
    return {
        type: 'ball',
        data: Float64Array.of(0, 0, radius),
        position: {
            value:        Float64Array.of(x, y),
            velocity:     Float64Array.of(vx, vy),
            acceleration: Float64Array.of(0, 0)
        },
        color: color
    };
}




const scalarData = {
    value:        0,
    velocity:     0,
    acceleration: 0
};

const vectorData = {
    value:        Float64Array.of(0, 0),
    velocity:     Float64Array.of(0, 0),
    acceleration: Float64Array.of(0, 0)
};

const updateValue = overload((object) => typeof object.value, {
    'number': function(object, duration) {
        const data = scalarData;

        data.velocity = (object.acceleration || 0) * duration;
        data.velocity += (object.velocity || 0);
        data.value = object.value + data.velocity * duration;

        return data;
    },

    'object': function(object, duration) {
        const data = vectorData;

        let n = -1;
        while(++n in data.value) {
            data.velocity[n] = (object.acceleration ? object.acceleration[n] : 0) * duration;
            data.velocity[n] += (object.velocity ? object.velocity[n] : 0);
            data.value[n] = object.value[n] + data.velocity[n] * duration;
        }

        return data;
    }
});



// Return value for update
const object1 = {};

export function update(t0, t1, ball) {
    object1.position = updateValue(ball.position, t1 - t0);
    return object1;
}

export function render(ctx, viewbox, style, ball) {
    ctx.save();
    ctx.translate(ball.position.value[0], ball.position.value[1]);
    //ctx.rotate(ball.rotation.value * 2 * Math.PI);

    drawCircle(ctx, ball.data, ball.data[2]);
    ctx.fillStyle = ball.color || style.getPropertyValue('--ball-fill');
    ctx.fill();
    ctx.restore();
}
