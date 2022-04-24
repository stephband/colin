
//import gaussian    from '../../fn/modules/gaussian.js';
import toCartesian from '../../../../fn/modules/to-cartesian.js';

const assign = Object.assign;
const pi     = Math.PI;
const turn   = Math.PI * 2;

let id = 0;

export default function Ball(element, x, y, r, vx, vy, vr, mass) {
    this.id      = ++id;
    this.element = element;
    this.type    = 'ball';
    this.data    = Float64Array.of(x,  y,  r, vx, vy, vr, 0, 9.8, 0);
    this.size    = 3;

    // Mass of a solid sphere
    this.mass    = (4 / 3) * pi * r * r * r;

    // Volume of sphere
    this.volume  = (4 / 3) * pi * r * r * r;
}

assign(Ball.prototype, {
    update: function(t1, t2) {

    },

    render: function() {
        // translate3d(xvmin, yvmin, 0);
        this.element.style.transform = 'translate3d(' +
            this.data[0] + 'vmin, ' +
            this.data[1] + 'vmin, 0)' ;
    }
});
