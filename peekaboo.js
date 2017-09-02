/*! peekaboo v1.0.0 MIT/GPL2 @freqdec */
(function(window, document) {
    "use strict";

    /** @global */
    var peekaboo = (function() {
            /**
             * The number of pixels outside of the viewport to take into account
             * while calculating if an element is visible
             * @var {Number} _rootMargin
             */
         var _rootMargin = 150,
            /**
             * An Object holding the patterns & callback functions declared
             * using the "observe" method of the peekaboo Object
             * @var {Object} observers
             */
            observers = {},
            /**
             * Have we added old-school scroll & resize listeners
             * @var {Boolean} listenersAdded
             */
            listenersAdded,
            /**
             * A reference to the scroll/resize event target
             * @var {Object} eventTarget
             */
            eventTarget,
            /**
             * Flag for determining if we can queue a requestAnimationFrame
             * @var {Boolean} tick
             */
            tick,
            /**
            * Used to cache the window width once per run
            * @var {Number} windowWidth
            */
            windowWidth,
            /**
            * Used to cache the window height once per run
            * @var {Number} windowHeight
            */
            windowHeight,
            /**
            * Does the browser support the InteractionObserver Interface
            * @var {Boolean} supportsIO
            */
            supportsIO = ("IntersectionObserver" in window),
            /**
             * An key/value store for the InteractionObservers
             * @var {Object} iO
             */
            iO = {};

        /**
         * Used as nodeList doesn't have a reliable cross browser forEach
         * method.
         *
         * @param {Array} array The Array to iterate over
         * @param {Function} callback The function to apply to each Array member
         * @param {Object} scope The scope in which to run the callback within
         */
        var forEach = function(array, callback, scope) {
            for (var i = 0; i < array.length; i++) {
                callback.call(scope, array[i]);
            }
        }

        /**
         * Checks an element is not hidden in the overflow of a parent element
         * or the viewport.
         *
         * @param {HTMLElement} el The DOM element to check
         * @returns {Boolean}
         */
        var meanIsVisible = function(el, rootMargin){
            var rect = el.getBoundingClientRect(),
                top = rect.top,
                left = rect.left,
                height = rect.height,
                width = rect.width,
                el = el.parentNode;

            // Check we are not hidden in the overflow of a parent container.
            // This is an expensive calculation and the much faster
            // leanIsVisible function should be used (by using the
            // fastVisibilityCheck option) whenever possible.
            while (el != document.body) {
                rect = el.getBoundingClientRect();
                if(!checkElementInBounds(top, left, width, height, rect.top,
                    rect.left, rect.width, rect.height, rootMargin)) {
                    return false;
                }
                el = el.parentNode;
            }

            // Finally do a viewport check
            return checkElementInBounds(top, left, width, height, 0, 0,
                windowWidth, windowHeight, rootMargin);
        }

        /**
         * Checks an element is not hidden in the overflow of the viewport. If
         * using this function then elements hidden in the overflow of a parent
         * container will not have their overflow calculated correctly.
         *
         * @param {HTMLElement} el The DOM element to check
         * @returns {Boolean}
         */
        var leanIsVisible = function(el, rootMargin) {
            var rect = el.getBoundingClientRect();
            return checkElementInBounds(rect.top, rect.left, rect.width,
                rect.height, 0, 0, windowWidth, windowHeight, rootMargin);
        }

        /**
         * Checks if a box is within the viewable bounds of a second box. The
         * value of rootMargin is taken into account during the calculation.
         *
         * @param {Number} t The top position of the first box
         * @param {Number} l The left position of the first box
         * @param {Number} w The width of the first box
         * @param {Number} h The height of the first box
         * @param {Number} eT The top position of the second box
         * @param {Number} eL The left position of the second box
         * @param {Number} eH The height of the second box
         * @param {Number} eW The width of the second box
         * @param {Number} rM The root margin to take into account
         * @returns {Boolean}
         */
        var checkElementInBounds = function(t, l, w, h, eT, eL, eW, eH, rM) {
            return !(t < eT - (h + rM)
                || t > eT + eH + rM
                || l < eL - (w + rM)
                || l > eL + eW + rM);
        }

        /**
         * requestAnimation frame will call this function which basically cycles
         * through the saved CSS Selectors, grabs the set of matching
         * elements and tests which are within the container viewport.
         *
         * @param {DOMHighResTimeStamp|Boolean} recalculateElementList A
         * Number representing a DOMHighResTimeStamp when called by
         * requestAnimationFrame and a Boolean true value when called by the
         * peekaboo.observe method. When the true value is passed, the element
         * list for all patterns is recalculated and the internal cache
         * updated
         */
        var updateElements = function(recalculateElementList) {
            var evtTarget = document,
                elemRevealTotal = 0,
                elemTotal = 0,
                elemReveal,
                rootMargin,
                inViewport,
                pattern;

            windowWidth = window.innerWidth;
            windowHeight = window.innerHeight;

            // Are we in a scroll container or the document
            if(typeof eventTarget === "undefined"
                || typeof eventTarget.tagName === "undefined") {
                evtTarget = document;
            } else if(eventTarget){
                evtTarget = eventTarget;
            }

            for (pattern in observers) {
                if(observers.hasOwnProperty(pattern)) {
                    // Can also be a DOMHighResTimeStamp so we need the ===
                    if(recalculateElementList === true) {
                        // IE9+ due to use of Array.prototype.slice.call
                        observers[pattern].elemList = Array.prototype.slice.call(evtTarget.querySelectorAll(pattern + ":not([data-peekaboo])"));
                    }

                    elemReveal = [];
                    elemTotal += observers[pattern].elemList.length;
                    rootMargin = observers[pattern].rootMargin;
                    inViewport = observers[pattern].fastVisibilityCheck ? leanIsVisible : meanIsVisible;

                    // IE9+ due to use of filter
                    observers[pattern].elemList = observers[pattern].elemList.filter(function(elem) {
                        if(inViewport(elem, rootMargin)) {
                            elem.setAttribute("data-peekaboo", pattern);
                            elemReveal.push(elem);
                            return false;
                        }
                        return true;
                    });

                    if(elemReveal.length) {
                        elemRevealTotal += elemReveal.length;
                        observers[pattern].callback(elemReveal);
                    }
                }
            }

            if(elemTotal - elemRevealTotal > 0 && !listenersAdded) {
                addOldSchoolListeners();
            } else if(!elemTotal && listenersAdded) {
                removeOldSchoolListeners();
            }

            tick = false;
        }

        /**
         * Adds the scroll & resize events for browsers not using the
         * IntersectionObserver.
         */
        var addOldSchoolListeners = function() {
            document.addEventListener("scroll", scrollResizeHandler, true);
            window.addEventListener("resize", scrollResizeHandler);
            listenersAdded = true;
        }

        /**
         * Removes the scroll & resize events for browsers not using the
         * IntersectionObserver.
         */
        var removeOldSchoolListeners = function() {
            document.removeEventListener("scroll", scrollResizeHandler);
            window.removeEventListener("resize", scrollResizeHandler);
            listenersAdded = false;
        }

        /**
         * Callback for the scroll and resize events for browsers that have no
         * InteractionObserver support.
         *
         * @param {UIEvent} e scroll/resize event Object
         */
        var scrollResizeHandler = function(e) {
            if(!tick) {
                eventTarget = e && e.target ? e.target : undefined;
                requestAnimationFrame(updateElements);
    	    }
    	    tick = true;
        }

        /**
         * Passes any required elements to the InteractionObserver.
         */
        var observeElements = function() {
            var pattern,
                rootMargin;

            for(pattern in observers) {
                if(observers.hasOwnProperty(pattern)) {
                    rootMargin = observers[pattern].rootMargin;
                    if(!iO.hasOwnProperty(rootMargin)) {
                        iO[rootMargin] = new IntersectionObserver(
                            observerCallback,
                            {
                                "rootMargin": rootMargin + "px"
                            }
                        );
                    }
                    // Only grab elements we are not already observing
                    forEach(document.querySelectorAll(pattern + ":not([data-peekaboo])"), function(elem) {
                        elem.setAttribute("data-peekaboo", pattern);
                        iO[rootMargin].observe(elem);
                    });
                }
            }
        }

        /**
         * Stops the elements that match the CSS Selector pattern from being
         * observed and cleans up any InteractionObservers now not being used.
         *
         * @param {String} pattern The CSS Selector pattern to stop observing
         */
        var unobserveElements = function(pattern) {
            var elemList,
                rootMargin;

            if(observers.hasOwnProperty(pattern)) {
                rootMargin = observers[pattern].rootMargin;
                forEach(document.querySelectorAll(pattern), function(elem) {
                    elem.removeAttribute("data-peekaboo");
                    if(supportsIO) {
                        iO[rootMargin].unobserve(elem);
                    }
                });
                delete observers[pattern];
                if(iO.hasOwnProperty(rootMargin)) {
                    for(pattern in observers) {
                        if(observers.hasOwnProperty(pattern) && observers[pattern].rootMargin == rootMargin) {
                            return;
                        }
                    }
                    delete iO[rootMargin];
                }
            }
        }

        /**
         * Callback for the InteractionObserver.
         *
         * @param {Array} elemList An Array of IntersectionObserverEntry Objects
         */
        var observerCallback = function(elemList) {
            var cbList = {},
                pattern;

            elemList.forEach(function(elem) {
                var pattern = elem.target.getAttribute("data-peekaboo");

                if (!observers.hasOwnProperty(pattern)
                    || elem.intersectionRatio <= 0) {
                    return;
                }

                if(!(pattern in cbList)) {
                    cbList[pattern] = [];
                }

                cbList[pattern].push(elem.target);

                iO[observers[pattern].rootMargin].unobserve(elem.target);
                elem.target.removeAttribute("data-peekaboo");
            });

            for(pattern in cbList) {
                if(cbList.hasOwnProperty(pattern)) {
                    observers[pattern].callback(cbList[pattern]);
                }
            }
        }

        /**
         * Creates and passes back the public API Object.
         *
         * @param {Function|Boolean} observeFunction A function to be used as
         * the peekaboo.observe public API method call or false if we are on
         * older non-compliant browsers and wish to return a public API stub
         */
        var init = function(observeFunction) {

            return !observeFunction ? {
                "observe":function() {},
                "unobserve":function() {},
                "supported":false
            } : {
                "observe": function(argObj) {
                    if(typeof argObj === "object") {
                        if(!typeof argObj.callback === "function") {
                            throw "No callback function passed within initialisation Object [callback]";
                        } else if(!(argObj.hasOwnProperty("pattern") && argObj.pattern)) {
                            throw "No CSS Selector passed within initialisation Object [pattern]";
                        }

                        // I can't find a better way to test the validity of a CSS Selector
                        try {
                            document.querySelectorAll(argObj.pattern + ":not([data-peekaboo])");
                        } catch (e) {
                            throw "Could not instantiate the CSS Selector [pattern]: " + argObj.pattern;
                        }

                        if(argObj.pattern in observers) {
                            throw "The CSS Selector [pattern] is already being observed: " + argObj.pattern;
                        }

                        observers[argObj.pattern] = {
                            "callback":argObj.callback,
                            "fastVisibilityCheck":!!argObj.fastVisibilityCheck,
                            "rootMargin":argObj.hasOwnProperty("rootMargin") && parseInt(argObj.rootMargin, 10) == argObj.rootMargin ? argObj.rootMargin : _rootMargin
                        }
                    }
                    observeFunction(true);
                },
                "unobserve":unobserveElements,
                "supported":true
            };
        }

        // Chrome only as of time of writing...
        if("IntersectionObserver" in window) {
            return init(observeElements);
        // Other newish browsers (IE10+)
        } else if("requestAnimationFrame" in window
                    && "querySelectorAll" in document
                    && "addEventListener" in document
                    && "getBoundingClientRect" in document.createElement('div')) {
            return init(updateElements);
        }

        // Return a polite non-breaking API stub for non compliant browsers
        return init(false);
    })();

    window.peekaboo = peekaboo;

})(window, document);
