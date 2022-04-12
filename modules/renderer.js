
import events from '../../dom/modules/events.js';
import { log, group, groupEnd } from './log.js';

const assign = Object.assign;
const define = Object.defineProperties;

export default function Renderer() {
    // Initialise to a stopped state, times in DOM time ms
    this.startTime   = undefined;
    this.stopTime    = 0;
    this.currentTime = 0;

    // Id of current animation frame
    this.frame       = null;

    // Stop animation while tab is hidden
    let hideState = 'stopped';

    events('visibilitychange', document).each((e) => {
        if (document.hidden) {
            hideState = this.state;
            if (hideState === 'playing') {
                this.stop();
            }
        }
        else {
            if (hideState === 'playing') {
                this.start();
            }
        }
    });
}

assign(Renderer.prototype, {
    /**
    .start(domTime, offset)
    **/
    start: function(domTime) {
        if (this.state === 'playing') {
            throw new Error('Attempt to .start() playing renderer');
        }

        const time = domTime || window.performance.now();
document.getElementById('times').innerHTML += (time.toFixed(3) + ' start<br/>');
        const wait = (domTime) => {
            // Wait until t1 is positive. We must do this because frame times lag
            // DOM time, so when start() is called the first frame is older than
            // startTime. If I'm honest, I still don't fully grok this. Essentially
            // it's the time of the previous rendered frame.
            if (domTime > this.startTime + this.currentTime) {
                return frame(domTime);
            }

            // Cue next frame if stopTime is greater than current render time
            this.frame = this.stopTime <= domTime ?
                null :
                requestAnimationFrame(wait) ;
        };

        const frame = (domTime) => {
            const time = this.stopTime <= domTime ?
                this.stopTime :
                domTime ;

            // Cue next frame if stopTime is greater than current render time
            this.frame = this.stopTime <= time ?
                null :
                requestAnimationFrame(frame) ;

            const t1 = this.currentTime / 1000;

            this.currentTime = time - this.startTime;

            const t2 = this.currentTime / 1000;

            /*if (window.DEBUG) {
                group(t1.toFixed(3) + ' - ' + t2.toFixed(3), 'frame');

                try {
                    // Run the render function an update current render time
                    this.render(t1, t2);
                }
                catch(e) {
                    this.stop();
                    throw e;
                }

                groupEnd();
            }
            else {*/
                // Run the render function an update current render time
                this.render(t1, t2);
            /*}*/

            if (window.DEBUG) { groupEnd(); }
        };

        this.startTime = time - this.currentTime;
        this.stopTime  = undefined;
        this.frame     = requestAnimationFrame(wait);

        if (window.DEBUG) {
            log((this.currentTime / 1000).toFixed(3), 'Renderer.start()', (time / 1000).toFixed(3));
        }

        return this;
    },

    /**
    .stop(domTime)
    **/
    stop: function(domTime) {
        if (this.state === 'stopped') {
            throw new Error('Attempt to .stop() stopped renderer');
        }

        this.stopTime = domTime || this.startTime + this.currentTime;
document.getElementById('times').innerHTML += (this.stopTime.toFixed(3) + ' stop<br/>');
        // Stop immediately where stopTime is less than or equal to current
        // render time
        if (this.stopTime <= this.startTime + this.currentTime) {
            cancelAnimationFrame(this.frame);
            this.frame = null;
        }

        if (window.DEBUG) {
            log(((this.stopTime - this.startTime) / 1000).toFixed(3), 'Renderer.stop()', (this.stopTime / 1000).toFixed(3));
        }

        return this;
    },

    /**
    .timeAtDomTime(domTime)
    **/
    timeAtDomTime: function timeAtDomTime(domTime) {
        return domTime > this.stopTime ?
            // Renderer is stopped, return last rendered time in s
            this.currentTime / 1000 :
            // Renderer is running, return time since startTime in s
            (domTime - this.startTime) / 1000 ;
    },

    /**
    .domTimeAtTime(time)
    **/
    domTimeAtTime: function domTimeAtTime(time) {
        return (this.startTime + time * 1000) > this.stopTime ?
            // Renderer is/will be stopped, return stopTime (in ms)
            this.stopTime :
            // Renderer is running, return time as DOM time (in ms)
            this.startTime + time * 1000 ;
    }
});

define(Renderer.prototype, {
    /**
    .state
    Returns `playing` or `stopped`.
    **/
    state: {
        get: function() {
            const domTime = window.performance.now();
            return this.startTime !== undefined
                && this.startTime <= domTime
                && (
                    this.stopTime === undefined
                    || this.startTime > this.stopTime
                    || domTime < this.stopTime
                ) ? 'playing' : 'stopped';
        }
    }
});
