
import Pool from './pool.js';

const assign = Object.assign;
const define = Object.defineProperties;

let count = 0;

function Collision(time, objectA, objectB, data) {
    this.count   = ++count;
    this.time    = time;
    this.objectA = objectA;
    this.objectB = objectB;
    this.data    = data;
}

define(Collision.prototype, {
    point: {
        get: function() {
            return this.data.slice(1, 3);
        }
    },

    dataA: {
        get: function() {
            return this.data.slice(3, 3 + this.objectA.size);
        }
    },

    dataB: {
        get: function() {
            return this.data.slice(3 + this.objectA.size);
        }
    }
});

export default Pool(Collision);
