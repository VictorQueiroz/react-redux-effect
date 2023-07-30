import { Middleware } from "redux";
import Effect, { IStore } from "./Effect";

export type { IStore, IEffectTaskAction } from "./Effect";
export { default as Effect, TaskIdProp, beginTask, finishTask } from "./Effect";

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
