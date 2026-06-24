/**
 * Local messaging primitives for AiPreviewAgentInspect — kept here to keep the
 * package self-contained. Bundles the typed Event, the BaseMessage contract,
 * and the MessageBroker interface used by MessagePublisher + LensMessageBroker.
 */

export type callback<Arg> = (args: Arg) => void
export type unsubscribe = () => void

/**
 * Represents the public api of an event.
 */
export interface PublicApi<Arg> {
  (cb: callback<Arg>): unsubscribe
  add(cb: callback<Arg>): unsubscribe
  remove(cb: callback<Arg>): void
}

/**
 * Event class with typed event arguments.
 */
export default class Event<Arg = void> {
  private subscribers: callback<Arg>[]

  constructor(...callbacks: (callback<Arg> | undefined)[]) {
    this.subscribers = callbacks.filter((cb) => cb !== undefined) as callback<Arg>[]
  }

  /**
   * Register an event handler
   *
   * @param handler to register
   * @returns the function to invoke when unsubscribing from the event.
   */
  public add(handler: callback<Arg>): unsubscribe {
    this.subscribers.push(handler)
    return () => this.remove(handler)
  }

  /**
   * Unregister an event handler
   *
   * @param handler to remove
   */
  public remove(handler: callback<Arg>) {
    this.subscribers = this.subscribers.filter((h) => {
      return h !== handler
    })
  }

  /**
   * Invoke the event and notify handlers
   *
   * @param arg Event args to pass to the handlers
   */
  public invoke(arg: Arg) {
    this.subscribers.forEach((handler) => {
      handler(arg)
    })
  }

  /**
   * Construct an object to serve as the publicApi of this
   * event. This makes it so an event can be used as "pre-bound"
   * function, and also prevents "invoke" from being called externally
   */
  public publicApi(): PublicApi<Arg> {
    const fn = this.add.bind(this) // Can add callbacks directly or invoke add.
    const addRemoveObject = {
      add: this.add.bind(this),
      remove: this.remove.bind(this)
    }

    const publicApi = Object.assign(fn, addRemoveObject)

    return publicApi
  }
}

/**
 * Base interface for all messages.
 * Each message must have a "type" property.
 */
export interface BaseMessage {
  type: string
}

/**
 * MessageBroker interface defines the methods for subscribing to and posting messages.
 *
 * @template In - The type of incoming messages.
 * @template Out - The type of outgoing messages.
 */
export interface MessageBroker<In extends BaseMessage, Out extends BaseMessage> {
  onMessageReceived: PublicApi<In>

  /**
   * Notifies all subscribers of a specific message type.
   * @param message - The message to notify subscribers about.
   */
  notify: (message: Out) => void
}
