import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

// Direct Line 3.0 types

export interface Conversation {
    conversationId: string;
    token: string;
    eTag?: string;
    streamUrl?: string;
}
export declare type MediaType = "image/png" | "image/jpg" | "image/jpeg" | "image/gif" | "audio/mpeg" | "audio/mp4" | "video/mp4";
export interface Media {
    contentType: MediaType;
    contentUrl: string;
    name?: string;
}
export interface CardAction {
    type: "imBack" | "postBack" | "openUrl" | "signin";
    title: string;
    value: string;
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
        VAT?: string;
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
export declare type Attachment = Media | HeroCard | Thumbnail | Signin | Receipt | AudioCard | VideoCard | AnimationCard | FlexCard;
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
}
export interface Typing extends IActivity {
    type: "typing";
}
export interface EventActivity extends IActivity {
    type: "event",
    name: string,
    value: any
}
export type Activity = Message | Typing | EventActivity;

// These types are specific to this client library, not to Direct Line 3.0

export declare enum ConnectionStatus {
    Uninitialized = 0,
    Connecting = 1,
    Online = 2,
    ExpiredToken = 3,
    FailedToConnect = 4,
    Ended = 5,
}
export interface IBotConnection {
    connectionStatus$: BehaviorSubject<ConnectionStatus>;
    activity$: Observable<Activity>;
    reconnect(conversation: Conversation): void;
    end(): void;
    postActivity(activity: Activity): Observable<string>;
}

export interface DirectLineOptions {
    secret?: string;
    token?: string;
    domain?: string;
    webSocket?: boolean;
}
export declare class DirectLine implements IBotConnection {
    constructor(options: DirectLineOptions);
    connectionStatus$: BehaviorSubject<ConnectionStatus>;
    activity$: Observable<Activity>;
    reconnect(conversation: Conversation): void;
    end(): void;
    postActivity(activity: Activity): Observable<string>;
}
