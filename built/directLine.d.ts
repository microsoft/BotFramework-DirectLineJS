import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/combineLatest';
import 'rxjs/add/operator/count';
import 'rxjs/add/operator/delay';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/retryWhen';
import 'rxjs/add/operator/share';
import 'rxjs/add/operator/take';
import 'rxjs/add/observable/dom/ajax';
import 'rxjs/add/observable/empty';
import 'rxjs/add/observable/from';
import 'rxjs/add/observable/interval';
import 'rxjs/add/observable/of';
import 'rxjs/add/observable/throw';
export interface Conversation {
    conversationId: string;
    token: string;
    eTag?: string;
    streamUrl?: string;
    referenceGrammarId?: string;
}
export declare type MediaType = "image/png" | "image/jpg" | "image/jpeg" | "image/gif" | "audio/mpeg" | "audio/mp4" | "video/mp4";
export interface Media {
    contentType: MediaType;
    contentUrl: string;
    name?: string;
    thumbnailUrl?: string;
}
export interface UnknownMedia {
    contentType: string;
    contentUrl: string;
    name?: string;
    thumbnailUrl?: string;
}
export declare type CardActionTypes = "openUrl" | "imBack" | "postBack" | "playAudio" | "playVideo" | "showImage" | "downloadFile" | "signin" | "call";
export interface CardAction {
    type: CardActionTypes;
    title: string;
    value: any;
    image?: string;
}
export interface HeroCard {
    contentType: "application/vnd.microsoft.card.hero";
    content: {
        title?: string;
        subtitle?: string;
        text?: string;
        images?: {
            url: string;
        }[];
        buttons?: CardAction[];
        tap?: CardAction;
    };
}
export interface Thumbnail {
    contentType: "application/vnd.microsoft.card.thumbnail";
    content: {
        title?: string;
        subtitle?: string;
        text?: string;
        images?: {
            url: string;
        }[];
        buttons?: CardAction[];
        tap?: CardAction;
    };
}
export interface Signin {
    contentType: "application/vnd.microsoft.card.signin";
    content: {
        text?: string;
        buttons?: CardAction[];
    };
}
export interface ReceiptItem {
    title?: string;
    subtitle?: string;
    text?: string;
    image?: {
        url: string;
    };
    price?: string;
    quantity?: string;
    tap?: CardAction;
}
export interface Receipt {
    contentType: "application/vnd.microsoft.card.receipt";
    content: {
        title?: string;
        facts?: {
            key: string;
            value: string;
        }[];
        items?: ReceiptItem[];
        tap?: CardAction;
        tax?: string;
        vat?: string;
        total?: string;
        buttons?: CardAction[];
    };
}
export interface FlexCard {
    contentType: "application/vnd.microsoft.card.flex";
    content: {
        title?: string;
        subtitle?: string;
        text?: string;
        images?: {
            url: string;
            tap?: CardAction;
        }[];
        buttons?: CardAction[];
        aspect?: string;
    };
}
export interface AudioCard {
    contentType: "application/vnd.microsoft.card.audio";
    content: {
        title?: string;
        subtitle?: string;
        text?: string;
        media?: {
            url: string;
            profile?: string;
        }[];
        buttons?: CardAction[];
        autoloop?: boolean;
        autostart?: boolean;
    };
}
export interface VideoCard {
    contentType: "application/vnd.microsoft.card.video";
    content: {
        title?: string;
        subtitle?: string;
        text?: string;
        media?: {
            url: string;
            profile?: string;
        }[];
        buttons?: CardAction[];
        image?: {
            url: string;
            alt?: string;
        };
        autoloop?: boolean;
        autostart?: boolean;
    };
}
export interface AdaptiveCard {
    contentType: "application/vnd.microsoft.card.adaptive";
    content: any;
}
export interface AnimationCard {
    contentType: "application/vnd.microsoft.card.animation";
    content: {
        title?: string;
        subtitle?: string;
        text?: string;
        media?: {
            url: string;
            profile?: string;
        }[];
        buttons?: CardAction[];
        image?: {
            url: string;
            alt?: string;
        };
        autoloop?: boolean;
        autostart?: boolean;
    };
}
export declare type KnownMedia = Media | HeroCard | Thumbnail | Signin | Receipt | AudioCard | VideoCard | AnimationCard | FlexCard | AdaptiveCard;
export declare type Attachment = KnownMedia | UnknownMedia;
export interface User {
    id: string;
    name?: string;
    iconUrl?: string;
}
export interface IActivity {
    type: string;
    channelData?: any;
    channelId?: string;
    conversation?: {
        id: string;
    };
    eTag?: string;
    from: User;
    id?: string;
    timestamp?: string;
}
export declare type AttachmentLayout = "list" | "carousel";
export interface Message extends IActivity {
    type: "message";
    text?: string;
    locale?: string;
    textFormat?: "plain" | "markdown" | "xml";
    attachmentLayout?: AttachmentLayout;
    attachments?: Attachment[];
    entities?: any[];
    suggestedActions?: {
        actions: CardAction[];
        to?: string[];
    };
    speak?: string;
    inputHint?: string;
    value?: object;
}
export interface Typing extends IActivity {
    type: "typing";
}
export interface EventActivity extends IActivity {
    type: "event";
    name: string;
    value: any;
}
export declare type Activity = Message | Typing | EventActivity;
export declare enum ConnectionStatus {
    Uninitialized = 0,
    Connecting = 1,
    Online = 2,
    ExpiredToken = 3,
    FailedToConnect = 4,
    Ended = 5,
}
export interface DirectLineOptions {
    secret?: string;
    token?: string;
    conversationId?: string;
    watermark?: string;
    domain?: string;
    webSocket?: boolean;
    pollingInterval?: number;
    streamUrl?: string;
}
export interface IBotConnection {
    connectionStatus$: BehaviorSubject<ConnectionStatus>;
    activity$: Observable<Activity>;
    end(): void;
    referenceGrammarId?: string;
    postActivity(activity: Activity): Observable<string>;
}
export declare class DirectLine implements IBotConnection {
    connectionStatus$: BehaviorSubject<ConnectionStatus>;
    activity$: Observable<Activity>;
    private domain;
    private webSocket;
    private conversationId;
    private secret;
    private token;
    private watermark;
    private streamUrl;
    referenceGrammarId: string;
    private pollingInterval;
    private tokenRefreshSubscription;
    constructor(options: DirectLineOptions);
    private checkConnection(once?);
    private expiredToken();
    private startConversation();
    private refreshTokenLoop();
    private refreshToken();
    reconnect(conversation: Conversation): void;
    end(): void;
    postActivity(activity: Activity): Observable<any>;
    private postMessageWithAttachments({attachments, ...messageWithoutAttachments});
    private catchPostError(error);
    private catchExpiredToken(error);
    private pollingGetActivity$();
    private observableFromActivityGroup(activityGroup);
    private webSocketActivity$();
    private isMobileOS();
    private observableWebSocket<T>();
    private reconnectToConversation();
}
