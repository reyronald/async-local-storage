import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Allows you to share data across a chain of asynchronous or synchronous
 * function calls without having to prop drill it through function arguments.
 *
 * Most often used with `express` or any HTTP Server to store values like user
 * state, claims from a JWT, correlation IDs, etc.
 *
 * @param name Name of your context. Used in error messages.
 * @param defaults
 * Default store with fallback values.
 * This will only be used if you try to access the context
 * without initializiting it (i.e. calling `runWithAsyncContext`),
 * which you shouldn't be doing.
 * @param options
 * `onError` will be called when you attempt to access an uninitialized context.
 * The error will not be thrown an instead passed as an argument to this function.
 * You can decide to ignore it, log it or throw it.
 * @returns
 */
export const getAsyncContext = <Store extends Record<string, unknown>>(
  name: string,
  defaults: Readonly<Store>,
  options: { onError: (error: Error) => void },
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

    if (!store) {
      const error = new Error(
        `AsyncLocalStorage "${name}" store undefined when getting a value.\n\n` +
          `This usually hapens when you don't initialize the context before trying to get a value.\n` +
          `Make sure you are using \`runWithAsyncContext\` to wrap your entry point.\n\n` +
          `Key: \t'${String(key)}'\n`,
      )

      options.onError(error)
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
