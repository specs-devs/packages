// Node test doubles for the three Leaf.lspkg modules Testing/ imports.
// _tsresolve.mjs maps those imports here. The real modules cannot load under
// node: Midi/Packages/Leaf.lspkg is a packed archive, and Logger calls Lens
// Studio globals (print, global.scene).
type Callback = () => void

/** Stand-in for Leaf.lspkg/Utils/common/LeafLifecycle. */
export class LeafLifecycle {
  private static instance: LeafLifecycle
  private callbacks: Callback[] = []

  onCleanup = {
    add: (cb: Callback): void => {
      this.callbacks.push(cb)
    },
    remove: (cb: Callback): void => {
      this.callbacks = this.callbacks.filter((c) => c !== cb)
    }
  }

  static getInstance(): LeafLifecycle {
    if (!this.instance) {
      this.instance = new LeafLifecycle()
    }
    return this.instance
  }

  invokeCleanup(): void {
    for (const cb of this.callbacks.slice()) {
      cb()
    }
  }

  get subscriberCount(): number {
    return this.callbacks.length
  }
}

/** Stand-in for Leaf.lspkg/Utils/common/Logger. Silent. */
export class Logger {
  constructor(_tag: string) {}
  debug(_msg: string): void {}
  info(_msg: string): void {}
  warn(_msg: string): void {}
  error(_msg: string): void {}
}

/** Stand-in for sleep() from Leaf.lspkg/Utils/common/Utils. */
export async function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
