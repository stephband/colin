
const assign = Object.assign;

export default function Box(element, x, y, w, h) {
    this.id      = 0;
    this.element = element;
    this.type    = 'box';
    this.data    = Float64Array.of(x, y, w, h, 0, 0, 0, 0, 0, 0, 0, 0);
    this.size    = 4;
}

assign(Box.prototype, {
    update: function(t1, t2) {

    },

    render: function() {

    }
});
