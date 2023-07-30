import { EventEmitter } from "eventual-js";

export interface IAction {
  type: string;
}

export type ActionLike = IAction | IBeginTaskAction | IFinishTaskAction;

export interface IStore<S = unknown, A extends ActionLike = ActionLike> {
  getState(): S;
  dispatch(action: A): void;
}

export interface IEffectEventMap {
  action: ActionLike;
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

const TaskIdProp = Symbol("reduxEffectTaskId");

export interface IEffectTaskAction {
  [TaskIdProp]: number;
  type: string;
}

function finishTask(taskId: number): IFinishTaskAction {
  return {
    type: "@@ReduxEffectActionType/FinishTaskAction",
    [TaskIdProp]: taskId,
  };
}

export interface IFinishTaskAction extends IEffectTaskAction {
  type: "@@ReduxEffectActionType/FinishTaskAction";
}

function beginTask<T extends IEffectTaskAction>(action: T): IBeginTaskAction {
  return {
    action,
    type: "@@ReduxEffectActionType/BeginTaskAction",
    [TaskIdProp]: action[TaskIdProp],
  };
}

export interface IBeginTaskAction extends IEffectTaskAction {
  type: "@@ReduxEffectActionType/BeginTaskAction";
  action: IAction;
}

export default abstract class Effect<
  Store = IStore
> extends EventEmitter<IEffectEventMap> {
  readonly #children;
  #pending = Promise.resolve();
  public constructor() {
    super();
    this.#children = new Set<Effect<Store>>();
  }
  public run(action: StoreAction<Store>) {
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
  public dispatch(action: ActionLike) {
    this.emit("action", action);
  }
  public add(effect: Effect<Store>) {
    this.#children.add(effect);
  }
  protected shouldProcessAction(_: StoreAction<Store>): boolean {
    return true;
  }
  protected abstract onAction(action: StoreAction<Store>): Promise<void>;
}
