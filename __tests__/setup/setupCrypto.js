const crypto = require('crypto');

global.crypto = {
  // uuid.v4() required Web Cryptography.
  // https://www.w3.org/TR/WebCryptoAPI/#Crypto-method-getRandomValues
  getRandomValues(array) {
    if (
      !(
        array instanceof Int8Array ||
        array instanceof Uint8Array ||
        array instanceof Int16Array ||
        array instanceof Uint16Array ||
        array instanceof In32Array ||
        array instanceof Uint32Array ||
        array instanceof Uint8ClampedArray
      )
    ) {
      throw new Error('TypeMismatchError');
    } else if (array.length > 65536) {
      throw new Error('QuotaExceededError');
    }

    return crypto.randomFillSync(array);
  }
};
