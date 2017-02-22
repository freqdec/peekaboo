# Peekaboo

Fires a one-time event whenever elements of your choice are about to scroll into the viewport. Perfect for just-in-time asset loading, for example; images, javascript libraries such as twitter and facebook, article comments or 3rd party advertisments.

* Uses the very fast IntersectionObserver API where possible
* Fallsback to using a single scroll and resize event in other browsers but hooks into requestAnimationFrame to stop scroll jank
* Correctly calculates if an observed element is hidden in the overflow of a parent element
* A little over 1k when minified & gzipped

See the [gitHub pages](https://freqdec.github.io/peekaboo/) demo site for more info.
