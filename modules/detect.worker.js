
import { detectCircleCircle, detectBoxCircle } from './collision.js';

const worker = self;

const detects = {
    // box circle
    10: detectBoxCircle,

    // circle circle
    12: detectCircleCircle
};

// A really naff way of detecting collision types
worker.onmessage = function(e) {
    const data = e.data;
    worker.postMessage(detects[data.length].apply(null, data));
}
