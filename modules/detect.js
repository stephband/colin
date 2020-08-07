
const detector = new Worker('./modules/detect.worker.js', { type: "module" });
const queue = [];

detector.onmessage = function(e) {
    const [resolve, reject] = queue.shift();
    const data = e.data;

    if (data) {
        resolve({
            t:     data[0],
            point: data.slice(1)
        });
    }
    else {
        reject('No collision');
    }
};

export function detect() {
    const data = Float64Array.from(arguments);
    return new Promise(function(resolve, reject) {
        queue.push(arguments);
        detector.postMessage(data);
    });
}
