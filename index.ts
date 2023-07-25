import { Middleware } from "redux";
import Effect, { IStore } from "./Effect";

export type { IStore } from "./Effect";
export { default as Effect } from "./Effect";

export default function effect<Store extends IStore>(
  effect: Effect<Store>,
  {
    onUnhandledRejection,
  }: Partial<{
    onUnhandledRejection: (value: unknown) => void;
  }> = {}
): Middleware {
  return (store) => {
    if (onUnhandledRejection) {
      effect.on("unhandledRejection", onUnhandledRejection);
    }
    effect.on("action", (action) => store.dispatch(action));
    return (next) => (action) => {
      effect.run(action);
      next(action);
    };
  };
}
