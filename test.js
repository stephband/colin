
import { noop } from '../fn/module.js';
import create from '../dom/modules/create.js';
import { drawPath, drawCircle } from './modules/canvas.js';

const A = Array.prototype;

const axes = [
    [-100, 0],
    [100, 0],
    [0, 0],
    [0, 100],
    [0, -100],
    [0, 0]
];

let testFn = noop;
let drawFn = noop;

export function group(text, fn, draw, run) {
    testFn = fn;
    drawFn = draw;
    document.body.appendChild(create('h2', text));
    run(test);
}

export function test(value) {
    // Do the test
    const args = A.slice.call(arguments, 1);
    const data = testFn.apply(null, args);

    // Draw the result
    const canvas = create('canvas', {
        width: 200,
        height: 200
    });

    const ctx = canvas.getContext('2d');
    ctx.translate(66.66666667, 66.66666667);
    ctx.scale(33.33333333, 33.33333333);

    // Draw axes
    drawPath(ctx, axes);
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 0.0125;
    ctx.stroke();

    // Draw objects
    drawFn.apply(null, [ctx, data, ...args]);

    // Draw collision
    if (data) {
        drawCircle(ctx, [data[1], data[2]], 0.15);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 0.1;
        ctx.stroke();
    }

    // Render data
    const div = create('div', {
        class: 'test-block block',
        children: data ? [
            canvas,
            create('p', {
                class: 'text-07',
                html: 't = ' + data[0].toFixed(3)
            }),
            create('p', {
                class: 'text-07',
                html: 'p = [' + data[1].toFixed(3) + ', ' + data[2].toFixed(3) + ']'
            }),
            data[3] !== undefined ?
                create('p', {
                    class: 'text-07',
                    html: 'data = [' + data.slice(3).map((n) => n.toFixed(3)).join(', ') + ']'
                }) :
                undefined
        ] : [
            canvas,
            create('p', {
                class: 'text-07',
                html: 'no collision'
            })
        ]
    });

    document.body.appendChild(div);
}



