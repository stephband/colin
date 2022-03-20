
import noop from '../../fn/modules/noop.js';

const DEBUG = window.DEBUG && window.console && window.console.log;

export const log = DEBUG ?
    function log(name, ...args) {
        window.console.log('%cColin %c' + name + '%c', 'color: #deaa2f; font-weight: 400;', 'color: #8e9e9d; font-weight: 400;', 'color: inherit; font-weight: 300;', ...args);
    } :
    noop ;

export const group = DEBUG ?
    function group(name, ...args) {
        window.console.group('%cColin %c' + name + '%c', 'color: #deaa2f; font-weight: 600;', 'color: #8e9e9d; font-weight: 400;', 'color: inherit; font-weight: 300;', ...args);
    } :
    noop ;

export const groupEnd = DEBUG ?
    function groupEnd() {
        window.console.groupEnd();
    } :
    noop ;
