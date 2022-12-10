import { AsyncLocalStorage } from "node:async_hooks";

type Store = {
  correlationId: string;
};

type Key = keyof Store;
type Values = Store[Key];

type StoreMap = Map<Key, Values>;

const defaults: Store = Object.freeze({
  correlationId: "",
});

const asyncLocalStorage = new AsyncLocalStorage<StoreMap>();

function set<TKey extends Key>(key: TKey, value: Store[TKey]) {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.set(key, value);
    return;
  }

  const serializedValue = JSON.stringify(value);
  throw new Error(
    `AsyncLocalStorage store undefined when setting a new value.\n\n` +
      `This usually hapens when you don't initialize the context before trying to set a value.\n` +
      `Make sure you are using \`runWithAsyncContext\` to wrap your entry point.\n\n` +
      `Key: \t'${key}'\nValue: \t'${serializedValue}'\n`
  );
}

function get<TKey extends Key>(key: TKey): Store[TKey] {
  const store = asyncLocalStorage.getStore();
  if (store?.has(key)) {
    const value = store.get(key);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- .
    return value as Store[TKey];
  }

  if (!store) {
    // @TODO
    // Consider throwing an error here like we do in the `set` function above.
    // This happens when we try to get a value from the store but we haven't initialized
    // the storage yet (see runWithHTTPContext below).
  }

  return defaults[key];
}

export const ctx = {
  set correlationId(correlationId: string) {
    set("correlationId", correlationId);
  },
  get correlationId(): string {
    return get("correlationId");
  },
};

export const runWithAsyncContext = <R>(next: () => R, initialStore: Store) => {
  const store: StoreMap = new Map();
  const result = asyncLocalStorage.run(store, () => {
    for (const [_key, value] of Object.entries(initialStore)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- .
      const key = _key as Key;
      set(key, value);
    }
    const result = next();
    return result;
  });
  return result;
};
