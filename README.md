# @reyronald/async-local-storage

Usage:

```ts
// Wrap the function that needs to have access to the context
runWithAsyncContext(
  () => {
    foo();
  },
  // Provide an initial store
  {
    correlationId: ":correlationId",
  }
);

// ...

// Now every function call in this chain will
// have access to `ctx` and its contents
function foo() {
  bar();
}
function bar() {
  baz();
}
function baz() {
  fn(ctx.correlationId);
}
```

Example with `express`:

```ts
const app = express();

app
  .use((req, _res, next) => {
    runWithAsyncContext(() => next(), { correlationId: ":correlationId" });
  })
  .get("/api/async-context-test", (_req, res) => {
    return res.send(ctx.correlationId);
  });
```
