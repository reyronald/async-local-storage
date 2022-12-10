import express from "express";
import supertest from "supertest";
import { ctx, runWithAsyncContext } from "./runWithAsyncContext";

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

describe("runWithAsyncContext", () => {
  it("should work with express", async () => {
    const app = express();

    const correlationId = ":correlationId";

    app
      .use((req, res, next) => {
        req.correlationId = correlationId;
        res.set("x-correlation-id", req.correlationId);
        return next();
      })
      .use((req, _res, next) => {
        runWithAsyncContext(() => next(), { correlationId: req.correlationId });
      })
      .get("/api/async-context-test", (_req, res) => {
        return res.send(ctx.correlationId);
      });

    const res = await supertest(app).get("/api/async-context-test");

    expect(res.headers["x-correlation-id"]).toEqual(correlationId);
    expect(res.text).toEqual(correlationId);
  });

  it("should error when trying to set value in an uninitialized context", () => {
    expect(() => {
      ctx.correlationId = ":correlationId";
    }).toThrowErrorMatchingInlineSnapshot(`
"AsyncLocalStorage store undefined when setting a new value.

This usually hapens when you don't initialize the context before trying to set a value.
Make sure you use \`middleware\` with express or \`runWithAsyncContext\` elsewhere.

Key: 	'correlationId'
Value: 	'":correlationId"'
"
`);
  });

  it("should use the correlationId from the initialStore in a synchronous chain of function calls", () => {
    const fn = jest.fn();

    const correlationId = ":correlationId";

    function foo() {
      bar();
    }
    function bar() {
      baz();
    }
    function baz() {
      fn(ctx.correlationId);
    }

    runWithAsyncContext(
      () => {
        foo();
      },
      {
        correlationId,
      }
    );

    expect(fn).toHaveBeenCalledWith(correlationId);
  });

  it("should use the updated correlationId after initialization in a synchronous chain of function calls", () => {
    const fn = jest.fn();

    const correlationId = ":correlationId";
    const correlationId_updated = ":correlationId_updated";

    function foo() {
      bar();
    }
    function bar() {
      baz();
    }
    function baz() {
      fn(ctx.correlationId);
    }

    runWithAsyncContext(
      () => {
        // Replace the correlationId from the initialStore with a new one
        // This is what we're testing
        ctx.correlationId = correlationId_updated;
        foo();
      },
      {
        correlationId,
      }
    );

    expect(fn).toHaveBeenCalledWith(correlationId_updated);
  });

  it("should use the correlationId from the initialStore in an asynchronous chain of function calls", async () => {
    const correlationId = ":correlationId";

    async function foo() {
      return await bar();
    }
    async function bar() {
      return await baz();
    }
    function baz() {
      return Promise.resolve(ctx.correlationId);
    }

    const result = await runWithAsyncContext(
      () => {
        return foo();
      },
      {
        correlationId,
      }
    );

    expect(result).toBe(correlationId);
  });

  it("should use the updated correlationId after initialization in a asynchronous chain of function calls", async () => {
    const correlationId = ":correlationId";
    const correlationId_updated = ":correlationId_updated";

    async function foo() {
      return await bar();
    }
    async function bar() {
      return await baz();
    }
    function baz() {
      return Promise.resolve(ctx.correlationId);
    }

    const result = await runWithAsyncContext(
      async () => {
        // Replace the correlationId from the initialStore with a new one
        // This is what we're testing
        ctx.correlationId = correlationId_updated;
        const result = await foo();
        return result;
      },
      {
        correlationId,
      }
    );

    expect(result).toBe(correlationId_updated);
  });

  it("should work as expected with multiple nested contexts", () => {
    const fn1 = jest.fn();
    const fn2 = jest.fn();

    const correlationId1 = ":correlationId_1";
    const correlationId2 = ":correlationId_2";

    function foo(cb: (c: string) => void) {
      bar(cb);
    }
    function bar(cb: (c: string) => void) {
      baz(cb);
    }
    function baz(cb: (c: string) => void) {
      cb(ctx.correlationId);
    }

    runWithAsyncContext(
      () => {
        runWithAsyncContext(
          () => {
            foo(fn2);
          },
          {
            correlationId: correlationId2,
          }
        );

        foo(fn1);
      },
      {
        correlationId: correlationId1,
      }
    );

    expect(fn1).toHaveBeenCalledWith(correlationId1);
    expect(fn2).toHaveBeenCalledWith(correlationId2);
  });
});
