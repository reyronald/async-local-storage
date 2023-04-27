import { AsyncLocalStorage } from "node:async_hooks"

export const getAsyncContext = <Store extends Record<string, unknown>>(
  name: string,
  defaults: Readonly<Store>,
) => {
  type Key = keyof Store
  type Values = Store[Key]

  type StoreMap = Map<Key, Values>

  const asyncLocalStorage = new AsyncLocalStorage<StoreMap>()

  function set<TKey extends Key>(key: TKey, value: Store[TKey]) {
    const store = asyncLocalStorage.getStore()
    if (store) {
      store.set(key, value)
      return
    }

    const serializedValue = JSON.stringify(value)
    throw new Error(
      `AsyncLocalStorage "${name}" store undefined when setting a new value.\n\n` +
        `This usually hapens when you don't initialize the context before trying to set a value.\n` +
        `Make sure you are using \`runWithAsyncContext\` to wrap your entry point.\n\n` +
        `Key: \t'${String(key)}'\nValue: \t'${serializedValue}'\n`,
    )
  }

  function get<TKey extends Key>(key: TKey): Store[TKey] {
    const store = asyncLocalStorage.getStore()
    if (store?.has(key)) {
      const value = store.get(key)
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- .
      return value as Store[TKey]
    }

    if (process.env.NODE_ENV !== "test") {
      if (!store) {
        const error = new Error(
          `AsyncLocalStorage "${name}" store undefined when getting a value.\n\n` +
            `This usually hapens when you don't initialize the context before trying to get a value.\n` +
            `Make sure you are using \`runWithAsyncContext\` to wrap your entry point.\n\n` +
            `Key: \t'${String(key)}'\n`,
        )

        // Log it but don't throw the error so that we don't crash the current request.
        // It's ok because we're falling back to a default value below.
        // We log it anyway so that we can be alerted if this hapepns and fix it.
        console.error(error)
      }
    }

    return defaults[key]
  }

  const ctxTarget = {} as Store
  const ctx = new Proxy(ctxTarget, {
    set(_obj, key, value) {
      set(String(key), value)
      return true
    },
    get(_obj, key) {
      return get(String(key))
    },
  })

  const runWithAsyncContext = <R>(initialStore: Store, next: () => R) => {
    const store: StoreMap = new Map()
    const result = asyncLocalStorage.run(store, () => {
      for (const [_key, _value] of Object.entries(initialStore)) {
        const key = _key as Key
        const value = _value as Store[Key]
        set(key, value)
      }
      const result = next()
      return result
    })
    return result
  }

  return {
    ctx,
    runWithAsyncContext,
  }
}
