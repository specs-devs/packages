import {BaseMessage, MessageBroker, unsubscribe} from "./Messaging"

export type MessageObject<T extends BaseMessage> = {
  data: T
}
export type MessageListenerCb<T extends BaseMessage> = (message: T) => void

export class MessagePublisher<In extends BaseMessage, Out extends BaseMessage> {
  protected registeredCallbacks: Partial<Record<BaseMessage["type"], ((message: In) => void)[]>> = {}
  private unknownHandler?: (message: In) => void

  constructor(private messageBroker: MessageBroker<In, Out>) {
    messageBroker.onMessageReceived.add((message: In) => {
      this.process(message)
    })
  }

  subscribe(messageType: In["type"], listenerCb: MessageListenerCb<In>): unsubscribe {
    if (!this.registeredCallbacks[messageType]?.length) {
      this.registeredCallbacks[messageType] = []
    } else {
      // A second subscriber for the same type would fire the handler twice
      // per incoming message, double-replying on the same commandId and
      // breaking the editor-side correlation map. Surface the condition;
      // do not silently accept the duplicate.
      print(
        `[MessagePublisher] W Duplicate subscribe() for message type "${messageType}" — ` +
          `ignoring. The first subscriber remains active.`
      )
      return () => {}
    }
    this.registeredCallbacks[messageType].push(listenerCb)
    return () => {
      this.registeredCallbacks[messageType] = this.registeredCallbacks[messageType]?.filter((cb) => cb !== listenerCb)
    }
  }

  /**
   * Registers a fallback that fires when a message arrives for a type with
   * no subscribers. Without this, unknown commands are silently dropped and
   * the caller waits forever.
   */
  setUnknownHandler(handler: (message: In) => void): void {
    this.unknownHandler = handler
  }

  private process(message: In): void {
    const subs = this.registeredCallbacks[message.type]
    if (subs && subs.length > 0) {
      subs.forEach((cb) => cb?.(message))
    } else {
      this.unknownHandler?.(message)
    }
  }

  notify(message: Out): void {
    this.messageBroker.notify(message)
  }
}
