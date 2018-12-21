import * as DirectLineExport from '../directLine';

test('#setConnectionStatusFallback', () => {
    const { DirectLine } = DirectLineExport;
    expect(typeof DirectLine.prototype.setConnectionStatusFallback).toBe('function')
    const { setConnectionStatusFallback } = DirectLine.prototype
    const testFallback = setConnectionStatusFallback(0, 1)
    let idx = 4
    while(idx--) {
      expect(testFallback(0)).toBe(0)
    }
    // fallback will be triggered
    expect(testFallback(0)).toBe(1)
    idx = 4
    while(idx--) {
        expect(testFallback(0)).toBe(0)
    }
    expect(testFallback(0)).toBe(1)
});
