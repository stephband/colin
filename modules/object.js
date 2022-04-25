
const assign = Object.assign;

let id = 0;

export function Object(type, size, ...data) {
    this.id   = ++id;
    this.type = type;
    this.size = size;
    this.data = assign(new Float64Array(3 * size), data);
}

assign(Object.prototype, {

});
