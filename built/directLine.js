"use strict";
// In order to keep file size down, only import the parts of rxjs that we use
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var BehaviorSubject_1 = require("rxjs/BehaviorSubject");
var Observable_1 = require("rxjs/Observable");
require("rxjs/add/operator/catch");
require("rxjs/add/operator/combineLatest");
require("rxjs/add/operator/count");
require("rxjs/add/operator/delay");
require("rxjs/add/operator/do");
require("rxjs/add/operator/filter");
require("rxjs/add/operator/map");
require("rxjs/add/operator/mergeMap");
require("rxjs/add/operator/retryWhen");
require("rxjs/add/operator/share");
require("rxjs/add/operator/take");
require("rxjs/add/observable/dom/ajax");
require("rxjs/add/observable/empty");
require("rxjs/add/observable/from");
require("rxjs/add/observable/interval");
require("rxjs/add/observable/of");
require("rxjs/add/observable/throw");
// These types are specific to this client library, not to Direct Line 3.0
var ConnectionStatus;
(function (ConnectionStatus) {
    ConnectionStatus[ConnectionStatus["Uninitialized"] = 0] = "Uninitialized";
    ConnectionStatus[ConnectionStatus["Connecting"] = 1] = "Connecting";
    ConnectionStatus[ConnectionStatus["Online"] = 2] = "Online";
    ConnectionStatus[ConnectionStatus["ExpiredToken"] = 3] = "ExpiredToken";
    ConnectionStatus[ConnectionStatus["FailedToConnect"] = 4] = "FailedToConnect";
    ConnectionStatus[ConnectionStatus["Ended"] = 5] = "Ended"; // the bot ended the conversation
})(ConnectionStatus = exports.ConnectionStatus || (exports.ConnectionStatus = {}));
var lifetimeRefreshToken = 30 * 60 * 1000;
var intervalRefreshToken = lifetimeRefreshToken / 2;
var defaultTimeout = 20 * 1000;
var defaultRetries = (lifetimeRefreshToken - intervalRefreshToken) / defaultTimeout;
var errorExpiredToken = new Error("expired token");
var errorConversationEnded = new Error("conversation ended");
var errorFailedToConnect = new Error("failed to connect");
var konsole = {
    log: function (message) {
        var optionalParams = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            optionalParams[_i - 1] = arguments[_i];
        }
        if (typeof window !== 'undefined' && window["botchatDebug"] && message)
            console.log.apply(console, [message].concat(optionalParams));
    }
};
var DirectLine = /** @class */ (function () {
    function DirectLine(options) {
        this.connectionStatus$ = new BehaviorSubject_1.BehaviorSubject(ConnectionStatus.Uninitialized);
        this.domain = "https://directline.botframework.com/v3/directline";
        this.watermark = '';
        this.timeout = defaultTimeout;
        this.retries = defaultRetries;
        this.pollingInterval = 1000;
        this.secret = options.secret;
        this.token = options.secret || options.token;
        this.webSocket = (options.webSocket === undefined ? true : options.webSocket) && typeof WebSocket !== 'undefined' && WebSocket !== undefined;
        if (options.domain) {
            this.domain = options.domain;
        }
        if (options.conversationId) {
            this.conversationId = options.conversationId;
        }
        if (options.watermark) {
            this.watermark = options.watermark;
        }
        if (options.streamUrl) {
            if (options.token && options.conversationId) {
                this.streamUrl = options.streamUrl;
            }
            else {
                console.warn('streamUrl was ignored: you need to provide a token and a conversationid');
            }
        }
        if (options.pollingInterval !== undefined) {
            this.pollingInterval = options.pollingInterval;
        }
        if (options.timeout) {
            this.timeout = options.timeout;
            this.retries = (lifetimeRefreshToken - intervalRefreshToken) / this.timeout;
        }
        this.activity$ = (this.webSocket
            ? this.webSocketActivity$()
            : this.pollingGetActivity$()).share();
    }
    // Every time we're about to make a Direct Line REST call, we call this first to see check the current connection status.
    // Either throws an error (indicating an error state) or emits a null, indicating a (presumably) healthy connection
    DirectLine.prototype.checkConnection = function (once) {
        var _this = this;
        if (once === void 0) { once = false; }
        var obs = this.connectionStatus$
            .flatMap(function (connectionStatus) {
            if (connectionStatus === ConnectionStatus.Uninitialized) {
                _this.connectionStatus$.next(ConnectionStatus.Connecting);
                //if token and streamUrl are defined it means reconnect has already been done. Skipping it.
                if (_this.token && _this.streamUrl) {
                    _this.connectionStatus$.next(ConnectionStatus.Online);
                    return Observable_1.Observable.of(connectionStatus);
                }
                else {
                    return _this.startConversation().do(function (conversation) {
                        _this.conversationId = conversation.conversationId;
                        _this.token = _this.secret || conversation.token;
                        _this.streamUrl = conversation.streamUrl;
                        _this.referenceGrammarId = conversation.referenceGrammarId;
                        if (!_this.secret)
                            _this.refreshTokenLoop();
                        _this.connectionStatus$.next(ConnectionStatus.Online);
                    }, function (error) {
                        _this.connectionStatus$.next(ConnectionStatus.FailedToConnect);
                    })
                        .map(function (_) { return connectionStatus; });
                }
            }
            else {
                return Observable_1.Observable.of(connectionStatus);
            }
        })
            .filter(function (connectionStatus) { return connectionStatus != ConnectionStatus.Uninitialized && connectionStatus != ConnectionStatus.Connecting; })
            .flatMap(function (connectionStatus) {
            switch (connectionStatus) {
                case ConnectionStatus.Ended:
                    return Observable_1.Observable.throw(errorConversationEnded);
                case ConnectionStatus.FailedToConnect:
                    return Observable_1.Observable.throw(errorFailedToConnect);
                case ConnectionStatus.ExpiredToken:
                    return Observable_1.Observable.of(connectionStatus);
                default:
                    return Observable_1.Observable.of(connectionStatus);
            }
        });
        return once ? obs.take(1) : obs;
    };
    DirectLine.prototype.expiredToken = function () {
        var connectionStatus = this.connectionStatus$.getValue();
        if (connectionStatus != ConnectionStatus.Ended && connectionStatus != ConnectionStatus.FailedToConnect)
            this.connectionStatus$.next(ConnectionStatus.ExpiredToken);
    };
    DirectLine.prototype.startConversation = function () {
        var _this = this;
        //if conversationid is set here, it means we need to call the reconnect api, else it is a new conversation
        var url = this.conversationId
            ? this.domain + "/conversations/" + this.conversationId + "?watermark=" + this.watermark
            : this.domain + "/conversations";
        var method = this.conversationId ? "GET" : "POST";
        return Observable_1.Observable.ajax({
            method: method,
            url: url,
            timeout: this.timeout,
            headers: {
                "Accept": "application/json",
                "Authorization": "Bearer " + this.token
            }
        })
            //      .do(ajaxResponse => konsole.log("conversation ajaxResponse", ajaxResponse.response))
            .map(function (ajaxResponse) { return ajaxResponse.response; })
            .retryWhen(function (error$) {
            // for now we deem 4xx and 5xx errors as unrecoverable
            // for everything else (timeouts), retry for a while
            return error$.mergeMap(function (error) { return error.status >= 400 && error.status < 600
                ? Observable_1.Observable.throw(error)
                : Observable_1.Observable.of(error); })
                .delay(_this.timeout)
                .take(_this.retries);
        });
    };
    DirectLine.prototype.refreshTokenLoop = function () {
        var _this = this;
        this.tokenRefreshSubscription = Observable_1.Observable.interval(intervalRefreshToken)
            .flatMap(function (_) { return _this.refreshToken(); })
            .subscribe(function (token) {
            konsole.log("refreshing token", token, "at", new Date());
            _this.token = token;
        });
    };
    DirectLine.prototype.refreshToken = function () {
        var _this = this;
        return this.checkConnection(true)
            .flatMap(function (_) {
            return Observable_1.Observable.ajax({
                method: "POST",
                url: _this.domain + "/tokens/refresh",
                timeout: _this.timeout,
                headers: {
                    "Authorization": "Bearer " + _this.token
                }
            })
                .map(function (ajaxResponse) { return ajaxResponse.response.token; })
                .retryWhen(function (error$) { return error$
                .mergeMap(function (error) {
                if (error.status === 403) {
                    // if the token is expired there's no reason to keep trying
                    _this.expiredToken();
                    return Observable_1.Observable.throw(error);
                }
                else if (error.status === 404) {
                    // If the bot is gone, we should stop retrying
                    return Observable_1.Observable.throw(error);
                }
                return Observable_1.Observable.of(error);
            })
                .delay(_this.timeout)
                .take(_this.retries); });
        });
    };
    DirectLine.prototype.reconnect = function (conversation) {
        this.token = conversation.token;
        this.streamUrl = conversation.streamUrl;
        if (this.connectionStatus$.getValue() === ConnectionStatus.ExpiredToken)
            this.connectionStatus$.next(ConnectionStatus.Online);
    };
    DirectLine.prototype.end = function () {
        if (this.tokenRefreshSubscription)
            this.tokenRefreshSubscription.unsubscribe();
        this.connectionStatus$.next(ConnectionStatus.Ended);
    };
    DirectLine.prototype.getSessionId = function () {
        var _this = this;
        // If we're not connected to the bot, get connected
        // Will throw an error if we are not connected
        konsole.log("getSessionId");
        return this.checkConnection(true)
            .flatMap(function (_) {
            return Observable_1.Observable.ajax({
                method: "GET",
                url: _this.domain + "/session/getsessionid",
                withCredentials: true,
                timeout: _this.timeout,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + _this.token
                }
            })
                .map(function (ajaxResponse) {
                if (ajaxResponse && ajaxResponse.response && ajaxResponse.response.sessionId) {
                    konsole.log("getSessionId response: " + ajaxResponse.response.sessionId);
                    return ajaxResponse.response.sessionId;
                }
                return '';
            })
                .catch(function (error) {
                konsole.log("getSessionId error: " + error.status);
                return Observable_1.Observable.of('');
            });
        })
            .catch(function (error) { return _this.catchExpiredToken(error); });
    };
    DirectLine.prototype.postActivity = function (activity) {
        var _this = this;
        // Use postMessageWithAttachments for messages with attachments that are local files (e.g. an image to upload)
        // Technically we could use it for *all* activities, but postActivity is much lighter weight
        // So, since WebChat is partially a reference implementation of Direct Line, we implement both.
        if (activity.type === "message" && activity.attachments && activity.attachments.length > 0)
            return this.postMessageWithAttachments(activity);
        // If we're not connected to the bot, get connected
        // Will throw an error if we are not connected
        konsole.log("postActivity", activity);
        return this.checkConnection(true)
            .flatMap(function (_) {
            return Observable_1.Observable.ajax({
                method: "POST",
                url: _this.domain + "/conversations/" + _this.conversationId + "/activities",
                body: activity,
                timeout: _this.timeout,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + _this.token
                }
            })
                .map(function (ajaxResponse) { return ajaxResponse.response.id; })
                .catch(function (error) { return _this.catchPostError(error); });
        })
            .catch(function (error) { return _this.catchExpiredToken(error); });
    };
    DirectLine.prototype.postMessageWithAttachments = function (_a) {
        var _this = this;
        var attachments = _a.attachments, messageWithoutAttachments = __rest(_a, ["attachments"]);
        var formData;
        // If we're not connected to the bot, get connected
        // Will throw an error if we are not connected
        return this.checkConnection(true)
            .flatMap(function (_) {
            // To send this message to DirectLine we need to deconstruct it into a "template" activity
            // and one blob for each attachment.
            formData = new FormData();
            formData.append('activity', new Blob([JSON.stringify(messageWithoutAttachments)], { type: 'application/vnd.microsoft.activity' }));
            return Observable_1.Observable.from(attachments || [])
                .flatMap(function (media) {
                return Observable_1.Observable.ajax({
                    method: "GET",
                    url: media.contentUrl,
                    responseType: 'arraybuffer'
                })
                    .do(function (ajaxResponse) {
                    return formData.append('file', new Blob([ajaxResponse.response], { type: media.contentType }), media.name);
                });
            })
                .count();
        })
            .flatMap(function (_) {
            return Observable_1.Observable.ajax({
                method: "POST",
                url: _this.domain + "/conversations/" + _this.conversationId + "/upload?userId=" + messageWithoutAttachments.from.id,
                body: formData,
                timeout: _this.timeout,
                headers: {
                    "Authorization": "Bearer " + _this.token
                }
            })
                .map(function (ajaxResponse) { return ajaxResponse.response.id; })
                .catch(function (error) { return _this.catchPostError(error); });
        })
            .catch(function (error) { return _this.catchPostError(error); });
    };
    DirectLine.prototype.catchPostError = function (error) {
        if (error.status === 403)
            // token has expired (will fall through to return "retry")
            this.expiredToken();
        else if (error.status >= 400 && error.status < 500)
            // more unrecoverable errors
            return Observable_1.Observable.throw(error);
        return Observable_1.Observable.of("retry");
    };
    DirectLine.prototype.catchExpiredToken = function (error) {
        return error === errorExpiredToken
            ? Observable_1.Observable.of("retry")
            : Observable_1.Observable.throw(error);
    };
    DirectLine.prototype.pollingGetActivity$ = function () {
        var _this = this;
        var poller$ = Observable_1.Observable.create(function (subscriber) {
            // A BehaviorSubject to trigger polling. Since it is a BehaviorSubject
            // the first event is produced immediately.
            var trigger$ = new BehaviorSubject_1.BehaviorSubject({});
            trigger$.subscribe(function () {
                if (_this.connectionStatus$.getValue() === ConnectionStatus.Online) {
                    var startTimestamp_1 = Date.now();
                    Observable_1.Observable.ajax({
                        headers: {
                            Accept: 'application/json',
                            Authorization: "Bearer " + _this.token
                        },
                        method: 'GET',
                        url: _this.domain + "/conversations/" + _this.conversationId + "/activities?watermark=" + _this.watermark,
                        timeout: _this.timeout
                    }).subscribe(function (result) {
                        subscriber.next(result);
                        setTimeout(function () { return trigger$.next(null); }, Math.max(0, _this.pollingInterval - Date.now() + startTimestamp_1));
                    }, function (error) {
                        switch (error.status) {
                            case 403:
                                _this.connectionStatus$.next(ConnectionStatus.ExpiredToken);
                                setTimeout(function () { return trigger$.next(null); }, _this.pollingInterval);
                                break;
                            case 404:
                                _this.connectionStatus$.next(ConnectionStatus.Ended);
                                break;
                            default:
                                // propagate the error
                                subscriber.error(error);
                                break;
                        }
                    });
                }
            });
        });
        return this.checkConnection()
            .flatMap(function (_) { return poller$
            .catch(function () { return Observable_1.Observable.empty(); })
            .map(function (ajaxResponse) { return ajaxResponse.response; })
            .flatMap(function (activityGroup) { return _this.observableFromActivityGroup(activityGroup); }); });
    };
    DirectLine.prototype.observableFromActivityGroup = function (activityGroup) {
        if (activityGroup.watermark)
            this.watermark = activityGroup.watermark;
        return Observable_1.Observable.from(activityGroup.activities);
    };
    DirectLine.prototype.webSocketActivity$ = function () {
        var _this = this;
        return this.checkConnection()
            .flatMap(function (_) {
            return _this.observableWebSocket()
                // WebSockets can be closed by the server or the browser. In the former case we need to
                // retrieve a new streamUrl. In the latter case we could first retry with the current streamUrl,
                // but it's simpler just to always fetch a new one.
                .retryWhen(function (error$) { return error$.delay(3000).mergeMap(function (error) { return _this.reconnectToConversation(); }); });
        })
            .flatMap(function (activityGroup) { return _this.observableFromActivityGroup(activityGroup); });
    };
    // Originally we used Observable.webSocket, but it's fairly opionated  and I ended up writing
    // a lot of code to work around their implemention details. Since WebChat is meant to be a reference
    // implementation, I decided roll the below, where the logic is more purposeful. - @billba
    DirectLine.prototype.observableWebSocket = function () {
        var _this = this;
        return Observable_1.Observable.create(function (subscriber) {
            konsole.log("creating WebSocket", _this.streamUrl);
            var ws = new WebSocket(_this.streamUrl);
            var sub;
            ws.onopen = function (open) {
                konsole.log("WebSocket open", open);
                // Chrome is pretty bad at noticing when a WebSocket connection is broken.
                // If we periodically ping the server with empty messages, it helps Chrome
                // realize when connection breaks, and close the socket. We then throw an
                // error, and that give us the opportunity to attempt to reconnect.
                sub = Observable_1.Observable.interval(_this.timeout).subscribe(function (_) { return ws.send(""); });
            };
            ws.onclose = function (close) {
                konsole.log("WebSocket close", close);
                if (sub)
                    sub.unsubscribe();
                subscriber.error(close);
            };
            ws.onmessage = function (message) { return message.data && subscriber.next(JSON.parse(message.data)); };
            // This is the 'unsubscribe' method, which is called when this observable is disposed.
            // When the WebSocket closes itself, we throw an error, and this function is eventually called.
            // When the observable is closed first (e.g. when tearing down a WebChat instance) then
            // we need to manually close the WebSocket.
            return function () {
                if (ws.readyState === 0 || ws.readyState === 1)
                    ws.close();
            };
        });
    };
    DirectLine.prototype.reconnectToConversation = function () {
        var _this = this;
        return this.checkConnection(true)
            .flatMap(function (_) {
            return Observable_1.Observable.ajax({
                method: "GET",
                url: _this.domain + "/conversations/" + _this.conversationId + "?watermark=" + _this.watermark,
                timeout: _this.timeout,
                headers: {
                    "Accept": "application/json",
                    "Authorization": "Bearer " + _this.token
                }
            })
                .do(function (result) {
                if (!_this.secret)
                    _this.token = result.response.token;
                _this.streamUrl = result.response.streamUrl;
            })
                .map(function (_) { return null; })
                .retryWhen(function (error$) { return error$
                .mergeMap(function (error) {
                if (error.status === 403) {
                    // token has expired. We can't recover from this here, but the embedding
                    // website might eventually call reconnect() with a new token and streamUrl.
                    _this.expiredToken();
                }
                else if (error.status === 404) {
                    return Observable_1.Observable.throw(errorConversationEnded);
                }
                return Observable_1.Observable.of(error);
            })
                .delay(_this.timeout)
                .take(_this.retries); });
        });
    };
    return DirectLine;
}());
exports.DirectLine = DirectLine;
//# sourceMappingURL=directLine.js.map