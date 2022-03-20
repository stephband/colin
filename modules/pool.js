
function isIdle(object) {
    return object.idle;
}

function release(object) {
    object.idle = true;
}

export default function Pool(Constructor) {
    const pool = [];

    function PooledObject() {
        let object = pool.find(isIdle);

        if (object) {
            Constructor.apply(object, arguments);
        }
        else {
            if (window.DEBUG) {
                console.groupCollapsed('%cPool   %c' + Constructor.name, 'color: #deaa2f; font-weight: 600;', 'color: #8e9e9d; font-weight: 300;', pool.length + 1);
            }

            object = new Constructor(...arguments);
            pool.push(object);

            if (window.DEBUG) {
                console.groupEnd();
            }
        }

        object.idle = false;
        return object;
	};

    PooledObject.isIdle  = isIdle;
    PooledObject.release = release;

    return PooledObject;
}
