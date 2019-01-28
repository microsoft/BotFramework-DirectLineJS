import * as DirectLineExport from "../directLine";

declare var process: {
    arch: string;
    env: {
        VERSION: string;
    };
    platform: string;
    release: string;
    version: string;
};

test("#setConnectionStatusFallback", () => {
    const { DirectLine } = DirectLineExport;
    expect(typeof DirectLine.prototype.setConnectionStatusFallback).toBe("function")
    const { setConnectionStatusFallback } = DirectLine.prototype;
    const testFallback = setConnectionStatusFallback(0, 1);
    let idx = 4;
    while (idx--) {
      expect(testFallback(0)).toBe(0);
    }
    // fallback will be triggered
    expect(testFallback(0)).toBe(1);
    idx = 4;
    while (idx--) {
        expect(testFallback(0)).toBe(0);
    }
    expect(testFallback(0)).toBe(1);
});

test("#commonHeaders", () => {
    const { DirectLine } = DirectLineExport;
    const botConnection = new DirectLine({ token: "secret-token", botAgent: "custom-bot-agent" });
    const botAgent = "DirectLine/3.0 (directlinejs/test-version; custom-bot-agent)";

    process.env.VERSION = "test-version";

    // @ts-ignore
    expect(botConnection.commonHeaders()).toEqual({
        "Authorization": "Bearer secret-token",
        "User-Agent": `${botAgent} (${window.navigator.userAgent})`,
        "x-ms-bot-agent": botAgent
    });

    // @ts-ignore
    delete window.navigator
    // @ts-ignore
    const os = require('os');
    const { arch, platform, version } = process;

    // @ts-ignore
    expect(botConnection.commonHeaders()).toEqual({
        "Authorization": "Bearer secret-token",
        "User-Agent": `${botAgent} (Node.js,Version=${version}; ${platform} ${os.release()}; ${arch})`,
        "x-ms-bot-agent": botAgent
    });
});
