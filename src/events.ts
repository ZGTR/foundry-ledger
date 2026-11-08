/**
 * Pub/sub: the controller announces what happened; whoever cares subscribes. Recording an
 * experiment does not know that a Markdown view re-renders after it, or that a reporter prints a
 * line: those are subscribers, added or removed in the composition root without touching the use
 * case (open/closed).
 */
import type { Experiment } from './domain/experiment.js';
import type { Ledger } from './domain/ledger.js';

export interface LedgerEvents {
  /** A new experiment was appended and the ledger saved. */
  'experiment.recorded': { experiment: Experiment; ledger: Ledger };
  /** Experiments were renumbered (a merge resolved an id collision). */
  'experiment.renumbered': { from: string; to: string };
  /** The ledger changed in some way (recorded, merged, imported); views re-render on this. */
  'ledger.changed': { ledger: Ledger; reason: string };
  /** A view was rendered and written. */
  'view.rendered': { view: string; experiments: number };
}

type Handler<T> = (payload: T) => void | Promise<void>;

/** A small typed event bus. Handlers run in subscription order; publish awaits them all. */
export class EventBus<E extends object = LedgerEvents> {
  private readonly handlers = new Map<keyof E, Handler<never>[]>();

  on<K extends keyof E>(event: K, handler: Handler<E[K]>): () => void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as Handler<never>);
    this.handlers.set(event, list);
    return () => {
      const at = list.indexOf(handler as Handler<never>);
      if (at >= 0) list.splice(at, 1);
    };
  }

  async publish<K extends keyof E>(event: K, payload: E[K]): Promise<void> {
    for (const handler of [...(this.handlers.get(event) ?? [])]) await (handler as Handler<E[K]>)(payload);
  }
}
