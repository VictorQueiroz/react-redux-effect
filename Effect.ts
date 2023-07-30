import { EventEmitter } from "eventual-js";

export interface IAction<T extends string = string> {
  type: T;
}

export interface IStore<S = unknown, A extends IAction = IAction> {
  getState(): S;
  dispatch(action: A): void;
}

export interface IEffectEventMap<Store extends IStore> {
  action: EffectStoreAction<Store>;
  unhandledRejection: unknown;
}

export type StoreAction<T> = T extends IStore<unknown, infer Actions>
  ? Actions
  : never;

export interface IEffect<Store extends IStore> {
  store: Store;
  onAction(action: StoreAction<Store>): Promise<void>;
  addEffect(value: IEffect<Store>): void;
}

export const TaskIdProp = Symbol("reduxEffectTaskId");

export type EffectTaskId = string;

export interface IEffectTaskAction<T = string> {
  [TaskIdProp]: EffectTaskId;
  type: T;
}

export function finishTask(taskId: EffectTaskId): IFinishTaskAction {
  return {
    type: ReduxEffectActionType.FinishTask,
    taskId,
  };
}

export interface IFinishTaskAction {
  type: ReduxEffectActionType.FinishTask;
  taskId: EffectTaskId;
}

export enum ReduxEffectActionType {
  BeginTask = "@@ReduxEffectActionType/BeginTask",
  FinishTask = "@@ReduxEffectActionType/FinishTask",
}

export function beginTask(action: IEffectTaskAction): IBeginTaskAction {
  return {
    action,
    type: ReduxEffectActionType.BeginTask,
  };
}

export interface IBeginTaskAction {
  type: ReduxEffectActionType.BeginTask;
  action: IEffectTaskAction;
}

type EffectStoreAction<T extends IStore> =
  | StoreAction<T>
  | IBeginTaskAction
  | IFinishTaskAction
  | IEffectTaskAction;

export default abstract class Effect<
  Store extends IStore<any, IBeginTaskAction | IFinishTaskAction>
> extends EventEmitter<IEffectEventMap<Store>> {
  readonly #children;
  #pending = Promise.resolve();
  public constructor() {
    super();
    this.#children = new Set<Effect<Store>>();
  }
  public run(action: EffectStoreAction<Store>) {
    if (this.shouldProcessAction(action)) {
      const requiresFinishedActions = TaskIdProp in action;
      const taskId = requiresFinishedActions ? action[TaskIdProp] : null;
      if (requiresFinishedActions) {
        this.dispatch(beginTask(action));
      }
      this.#pending = this.#pending.then(() =>
        this.onAction(action)
          .catch((reason) => {
            this.emit("unhandledRejection", reason);
          })
          .finally(() => {
            if (taskId !== null) {
              this.dispatch(finishTask(taskId));
            }
          })
      );
    }
    for (const child of this.#children) {
      child.run(action);
    }
  }
  public dispatch(action: EffectStoreAction<Store>) {
    this.emit("action", action);
  }
  public add(effect: Effect<Store>) {
    this.#children.add(effect);
  }
  protected shouldProcessAction(_: EffectStoreAction<Store>): boolean {
    return true;
  }
  protected abstract onAction(action: EffectStoreAction<Store>): Promise<void>;
}

// it should not accept store that do not accept actions with begin and finish task actions
{
  type TestActions1 =
    | {
        type: "a";
      }
    | {
        type: "b";
      };

  // @ts-expect-error
  type Test1 = Effect<IStore<{}, TestActions1>>;
}
