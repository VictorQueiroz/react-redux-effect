import { EventEmitter } from "eventual-js";

export interface IAction {
  type: string;
}

export interface IStore<S = unknown, A extends IAction = IAction> {
  getState(): S;
  dispatch(action: A): void;
}

export interface IEffectEventMap<Store extends IStore> {
  action: StoreAction<Store>;
  unhandledRejection: unknown;
}

export type StoreAction<T> = T extends IStore<any, infer Actions>
  ? Actions
  : never;

export interface IEffect<Store extends IStore> {
  store: Store;
  onAction(action: StoreAction<Store>): Promise<void>;
  addEffect(value: IEffect<Store>): void;
}

export default abstract class Effect<Store extends IStore> extends EventEmitter<
  IEffectEventMap<Store>
> {
  readonly #children;
  #pending = Promise.resolve();
  public constructor() {
    super();
    this.#children = new Set<Effect<Store>>();
  }
  public run(action: StoreAction<Store>) {
    if (this.shouldProcessAction(action)) {
      this.#pending = this.#pending.then(() =>
        this.onAction(action).catch((reason) => {
          this.emit("unhandledRejection", reason);
        })
      );
    }
    for (const child of this.#children) {
      child.run(action);
    }
  }
  public add(effect: Effect<Store>) {
    this.#children.add(effect);
  }
  protected shouldProcessAction(_: StoreAction<Store>): boolean {
    return true;
  }
  protected abstract onAction(action: StoreAction<Store>): Promise<void>;
}
