import Effect, { IStore, StoreAction } from "./Effect";

export default abstract class EffectAsync<
  Store extends IStore
> extends Effect<Store> {
  readonly #actions = new Array<StoreAction<Store>>();
  #lazyEffect: {
    promise: Promise<void>;
    /**
     * if true, the effect has already been added to the effect
     */
    added: boolean;
  } | null = null;
  protected abstract shouldCreateEffect(action: StoreAction<Store>): boolean;
  public abstract createEffect(): Promise<Effect<Store>>;
  public override run(action: StoreAction<Store>) {
    if (!this.shouldCreateEffect(action)) {
      return;
    }
    let lazyEffect = this.#lazyEffect;
    if (lazyEffect?.added) {
      super.run(action);
      return;
    }
    /**
     * add pending actions
     */
    this.#actions.push(action);
    /**
     * create action
     */
    if (!lazyEffect) {
      const lazyEffect = {
        promise: Promise.resolve(),
        added: false,
      };
      const promise = this.createEffect()
        .then((effect) => this.add(effect))
        .catch((reason) => this.emit("unhandledRejection", reason))
        .finally(() => {
          lazyEffect.added = true;
          for (const a of this.#actions.splice(0, this.#actions.length)) {
            this.run(a);
          }
        });
      lazyEffect.promise = promise;
      this.#lazyEffect = lazyEffect;
    }
  }
}
