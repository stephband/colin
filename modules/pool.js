
const DEBUG = true;
const assign = Object.assign;

export default function Pool(Constructor, isIdle) {
    const pool = this.pool = [];
    
    return function Pooled() {
        let object = pool.find(isIdle);

        if (object) {
            Constructor.apply(object, arguments);
            return object;
        }

        if (DEBUG) {
            console.groupCollapsed('%cPool   %c' + Constructor.name, 'color: #deaa2f; font-weight: 600;', 'color: #8e9e9d; font-weight: 300;', pool.length + 1);
        }

        object = new Constructor(...arguments);
        pool.push(object);

        if (DEBUG) {
            console.groupEnd();
        }

        return object;
	};
}
