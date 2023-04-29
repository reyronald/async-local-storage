import express from "express"
import supertest from "supertest"
import { getAsyncContext } from "./asyncContext"

declare global {
  namespace Express {
    interface Request {
      correlationId: string
    }
  }
}

type Store = { correlationId: string }

describe("asyncContext", () => {
  it("should work with express", async () => {
    const app = express()

    const correlationId = ":correlationId"

    const { ctx, runWithAsyncContext } = getAsyncContext<Store>(
      "correlationId-context",
      { correlationId },
      { onError: jest.fn() },
    )

    app
      .use((req, res, next) => {
        req.correlationId = correlationId
        res.set("x-correlation-id", req.correlationId)
        return next()
      })
      .use((req, _res, next) => {
        runWithAsyncContext({ correlationId: req.correlationId }, () => next())
      })
      .get("/api/async-context-test", (_req, res) => {
        return res.send(ctx.correlationId)
      })

    const res = await supertest(app).get("/api/async-context-test")

    expect(res.headers["x-correlation-id"]).toEqual(correlationId)
    expect(res.text).toEqual(correlationId)
  })

  it("should error when trying to set value in an uninitialized context", () => {
    const correlationId = ":correlationId"
    const { ctx } = getAsyncContext<Store>(
      "correlationId-context",
      { correlationId },
      { onError: jest.fn() },
    )

    expect(() => {
      ctx.correlationId = ":correlationId"
    }).toThrowErrorMatchingInlineSnapshot(`
"AsyncLocalStorage "correlationId-context" store undefined when setting a new value.

This usually hapens when you don't initialize the context before trying to set a value.
Make sure you are using \`runWithAsyncContext\` to wrap your entry point.

Key: 	'correlationId'
Value: 	'":correlationId"'
"
`)
  })

  it("should use the correlationId from the initialStore in a synchronous chain of function calls", () => {
    const fn = jest.fn()

    const correlationId = ":correlationId"

    const { ctx, runWithAsyncContext } = getAsyncContext<Store>(
      "correlationId-context",
      { correlationId },
      { onError: jest.fn() },
    )

    function foo() {
      bar()
    }
    function bar() {
      baz()
    }
    function baz() {
      fn(ctx.correlationId)
    }

    runWithAsyncContext({ correlationId }, () => {
      foo()
    })

    expect(fn).toHaveBeenCalledWith(correlationId)
  })

  it("should use the updated correlationId after initialization in a synchronous chain of function calls", () => {
    const fn = jest.fn()

    const correlationId = ":correlationId"
    const correlationId_updated = ":correlationId_updated"

    const { ctx, runWithAsyncContext } = getAsyncContext<Store>(
      "correlationId-context",
      { correlationId },
      { onError: jest.fn() },
    )

    function foo() {
      bar()
    }
    function bar() {
      baz()
    }
    function baz() {
      fn(ctx.correlationId)
    }

    runWithAsyncContext({ correlationId }, () => {
      // Replace the correlationId from the initialStore with a new one
      // This is what we're testing
      ctx.correlationId = correlationId_updated
      foo()
    })

    expect(fn).toHaveBeenCalledWith(correlationId_updated)
  })

  it("should use the correlationId from the initialStore in an asynchronous chain of function calls", async () => {
    const correlationId = ":correlationId"

    const { ctx, runWithAsyncContext } = getAsyncContext<Store>(
      "correlationId-context",
      { correlationId },
      { onError: jest.fn() },
    )

    async function foo() {
      return await bar()
    }
    async function bar() {
      return await baz()
    }
    function baz() {
      return Promise.resolve(ctx.correlationId)
    }

    const result = await runWithAsyncContext({ correlationId }, () => {
      return foo()
    })

    expect(result).toBe(correlationId)
  })

  it("should use the updated correlationId after initialization in a asynchronous chain of function calls", async () => {
    const correlationId = ":correlationId"
    const correlationId_updated = ":correlationId_updated"

    const { ctx, runWithAsyncContext } = getAsyncContext<Store>(
      "correlationId-context",
      { correlationId },
      { onError: jest.fn() },
    )

    async function foo() {
      return await bar()
    }
    async function bar() {
      return await baz()
    }
    function baz() {
      return Promise.resolve(ctx.correlationId)
    }

    const result = await runWithAsyncContext({ correlationId }, async () => {
      // Replace the correlationId from the initialStore with a new one
      // This is what we're testing
      ctx.correlationId = correlationId_updated
      const result = await foo()
      return result
    })

    expect(result).toBe(correlationId_updated)
  })

  it("should work as expected with multiple nested contexts", () => {
    const fn1 = jest.fn()
    const fn2 = jest.fn()

    const correlationId1 = ":correlationId_1"
    const correlationId2 = ":correlationId_2"

    const { ctx, runWithAsyncContext } = getAsyncContext<Store>(
      "correlationId-context",
      { correlationId: "default-correlation-id" },
      { onError: jest.fn() },
    )

    function foo(cb: (c: string) => void) {
      bar(cb)
    }
    function bar(cb: (c: string) => void) {
      baz(cb)
    }
    function baz(cb: (c: string) => void) {
      cb(ctx.correlationId)
    }

    runWithAsyncContext({ correlationId: correlationId1 }, () => {
      runWithAsyncContext({ correlationId: correlationId2 }, () => {
        foo(fn2)
      })

      foo(fn1)
    })

    expect(fn1).toHaveBeenCalledWith(correlationId1)
    expect(fn2).toHaveBeenCalledWith(correlationId2)
  })

  it("should call onError when trying to access store without initializing it", () => {
    const fn = jest.fn()

    const correlationId = ":correlationId"

    const onError = jest.fn()

    const { ctx } = getAsyncContext<Store>(
      "correlationId-context",
      { correlationId },
      { onError },
    )

    expect(onError).not.toHaveBeenCalled()

    // Try to access context store without initializing it (i.e. using `runWithAsyncContext`).
    // Should call `onError`
    ctx.correlationId

    expect(onError).toHaveBeenCalled()
    expect(onError.mock.calls).toMatchInlineSnapshot(`
[
  [
    [Error: AsyncLocalStorage "correlationId-context" store undefined when getting a value.

This usually hapens when you don't initialize the context before trying to get a value.
Make sure you are using \`runWithAsyncContext\` to wrap your entry point.

Key: 	'correlationId'
],
  ],
]
`)
  })
})
