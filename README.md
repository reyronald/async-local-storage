# @reyronald/async-local-storage

Allows you to share data across a chain of asynchronous or synchronous function calls without having to prop drill it through function arguments.

Most often used with `express` or any HTTP Server to store things like user state, claims from a JWT, correlation IDs, etc.

Better alternative to https://npm.im/continuation-local-storage, https://npm.im/cls-hooked and https://npm.im/express-http-context because those use a deprecated experimental and unsafe legacy Node.js API ([https://nodejs.org/api/async_hooks.html](async_hooks)). This one uses [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage) which is already stable and the currently recommended best practice.

Usage:

```ts
type Store = { correlationId: string }

const { ctx, runWithAsyncContext } = getAsyncContext<Store>(
  "correlationId-context",
  { correlationId: "default-correlationId" },
)

// Wrap the start of the function chain that needs to have access to the context
runWithAsyncContext(
  // Provide an initial store
  { correlationId: ":correlationId" },
  // Start of the chain
  () => {
    foo()
  },
)

// ...

// Now every function call in this chain will
// have access to `ctx` and its contents
function foo() {
  bar()
}
function bar() {
  baz()
}
function baz() {
  fn(ctx.correlationId) // ":correlationId"
}
```

Example with `express`:

```ts
const app = express()

app
  .use((req, _res, next) => {
    runWithAsyncContext({ correlationId: ":correlationId" }, () => next())
  })
  .get("/api/async-context-test", (_req, res) => {
    return res.send(ctx.correlationId)
  })
```

### TODO

- [ ] Setup prettier commit hooks
- [ ] Autogenerate definition files .d.ts
- [ ] eslint
