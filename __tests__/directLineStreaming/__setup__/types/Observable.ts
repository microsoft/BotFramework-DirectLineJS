// This is a declaration file for a single ES feature. Could contains multiple classes definitions.
/* eslint-disable max-classes-per-file */

// Adopted from https://github.com/tc39/proposal-observable.

/** Receives a completion notification */
type CompleteFunction = () => void;

/** Receives the sequence error */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ErrorFunction = (reason: any) => void;

/** Receives the next value in the sequence */
type NextFunction<T> = (value: T) => void;

/** Subscribes to the observable */
type SubscriberFunction<T> = (observer: SubscriptionObserver<T>) => (() => void) | Subscription | void;

/** An `Observable` represents a sequence of values which may be observed. */
declare interface Observable<T> {
  // eslint-disable-next-line @typescript-eslint/no-misused-new
  new (subscriber: SubscriberFunction<T>): Observable<T>;

  /** Subscribes to the sequence with an observer */
  subscribe(observer: Observer<T>): Subscription;

  /** Subscribes to the sequence with callbacks */
  subscribe(onNext: NextFunction<T>, onError?: ErrorFunction, onComplete?: CompleteFunction): Subscription;
}

declare class Subscription {
  /** A boolean value indicating whether the subscription is closed */
  get closed(): boolean;

  /** Cancels the subscription */
  public unsubscribe(): void;
}

/**
 * An `Observer` is used to receive data from an `Observable`, and is supplied as an argument to `subscribe`.
 *
 * All methods are optional.
 */
declare class Observer<T> {
  /** Receives a completion notification */
  complete?: CompleteFunction;

  /** Receives the sequence error */
  error?: ErrorFunction;

  /** Receives the next value in the sequence */
  next?: NextFunction<T>;

  /** Receives the subscription object when `subscribe` is called */
  start?: (subscription: Subscription) => void;
}

/** A `SubscriptionObserver` is a normalized `Observer` which wraps the observer object supplied to `subscribe`. */
declare class SubscriptionObserver<T> {
  /** Sends the completion notification */
  complete: CompleteFunction;

  /** Sends the sequence error */
  error: ErrorFunction;

  /** Sends the next value in the sequence */
  next: NextFunction<T>;

  /** A boolean value indicating whether the subscription is closed */
  get closed(): boolean;
}

export type { Observable, Observer, Subscription, SubscriptionObserver };
