// Adopted from @testing-library/dom and removed dependencies on DOM.
// https://github.com/testing-library/dom-testing-library/blob/eadf7485430968df8d1e1293535d78cdbeea20a5/src/helpers.js

export default function jestFakeTimersAreEnabled(): boolean {
  /* istanbul ignore else */
  // eslint-disable-next-line
  if (typeof jest !== 'undefined' && jest !== null) {
    return (
      // legacy timers
      (setTimeout as any)._isMockFunction === true ||
      // modern timers
      // eslint-disable-next-line prefer-object-has-own -- not supported by our support matrix
      Object.prototype.hasOwnProperty.call(setTimeout, 'clock')
    );
  }

  // istanbul ignore next
  return false;
}
