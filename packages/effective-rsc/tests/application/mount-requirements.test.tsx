import { describe, expect, it } from '@effect/vitest';
import { Context, Effect, FiberSet, Layer, Schema } from 'effect';
import { HttpRouter, HttpServerResponse } from 'effect/unstable/http';

import { getApplicationState } from '../../src/application/definition';
import { Application } from '../../src/application/ersc';
import { getERSCIdentity } from '../../src/application/ersc-identity';
import { applyMiddleware } from '../../src/application/middleware';

class Organization extends Context.Service<Organization, { readonly id: string }>()(
  'mount/Organization',
) {}

const ERSC = Application.ersc();
const Todos = ERSC.withRequirements<Organization>();
const Shell = ERSC.Layout.make({ render: ({ children }) => Effect.succeed(children) });
const Index = Todos.Page.make({ render: () => Effect.map(Organization, (org) => org.id) });
const Todo = Todos.Page.make({
  params: Schema.Struct({ todoId: Schema.String }),
  render: ({ params }) => Effect.map(Organization, (org) => `${org.id}/${params.todoId}`),
});
const todos = Todos.Routes.make({ layout: Shell }).page('/', Index).page('/items/:todoId', Todo);

const mounted = (calls: Array<string>) =>
  ERSC.make({
    routes: ERSC.Routes.make({ layout: Shell })
      .mount('/orgs/:orgId', ERSC.Routes.make().mount('/todos', todos), {
        params: Schema.Struct({ orgId: Schema.Literals(['alpha', 'beta']) }),
        provide: ({ params }) =>
          Effect.sync(() => {
            calls.push(params.orgId);
            return Context.make(Organization, { id: params.orgId });
          }),
      })
      .mount('/teams/:team', todos, {
        params: Schema.Struct({ team: Schema.String }),
        provide: ({ params }) => Effect.succeed(Context.make(Organization, { id: params.team })),
      }),
  });

describe('mount service requirements', () => {
  it.effect('decodes each mount once, isolates requests, and keeps child Page params local', () =>
    Effect.gen(function* () {
      const calls: Array<string> = [];
      const application = mounted(calls);
      const identity = getERSCIdentity(application);
      const destinations = getApplicationState(application).routes;
      const layers = destinations.map((destination) =>
        HttpRouter.add(
          'GET',
          destination.pattern,
          applyMiddleware(
            destination.middleware,
            Effect.gen(function* () {
              const runtime = yield* FiberSet.makeRuntimePromise<never>();
              const allParams = yield* HttpRouter.params;
              const localParams = Object.fromEntries(
                destination.pageParameterNames.map((name) => [name, allParams[name]]),
              );
              const value = yield* destination.page.paramsSchema === null
                ? Effect.succeed({})
                : Schema.decodeEffect(destination.page.paramsSchema)(localParams);
              const rendered = yield* Effect.promise(() =>
                identity.renderRuntime.bind(runtime, destination.middleware, () =>
                  destination.page.component({ params: { _tag: 'Decoded', value } }),
                ),
              );
              return HttpServerResponse.text(
                typeof rendered === 'string' ? rendered : 'unexpected node',
              );
            }),
          ),
        ),
      );
      const { handler, dispose } = HttpRouter.toWebHandler(Layer.mergeAll(Layer.empty, ...layers), {
        disableLogger: true,
      });
      try {
        const urls = ['/orgs/alpha/todos', '/orgs/beta/todos/items/42', '/teams/gamma/items/9'];
        const responses = yield* Effect.promise(() =>
          Promise.all(urls.map((url) => handler(new Request(`http://localhost${url}`)))),
        );
        const values = yield* Effect.promise(() =>
          Promise.all(responses.map((response) => response.text())),
        );
        expect(values).toEqual(['alpha', 'beta/42', 'gamma/9']);
        expect(calls.sort()).toEqual(['alpha', 'beta']);
        const rejected = yield* Effect.promise(() =>
          handler(new Request('http://localhost/orgs/invalid/todos')),
        );
        expect(rejected.status).toBe(404);
        const rejectedBody = yield* Effect.promise(() => rejected.text());
        expect(rejectedBody).toBe('');
        expect(calls).toHaveLength(2);
        const head = yield* Effect.promise(() =>
          handler(new Request('http://localhost/orgs/alpha/todos', { method: 'HEAD' })),
        );
        expect(head.status).toBe(200);
        const headBody = yield* Effect.promise(() => head.text());
        expect(headBody).toBe('');
      } finally {
        yield* Effect.promise(dispose);
      }
    }),
  );

  it.effect(
    'runs the same graph independently with an explicitly provided application service',
    () =>
      Effect.gen(function* () {
        const application = ERSC.make({
          routes: todos,
          layer: Layer.succeed(Organization, { id: 'standalone' }),
        });
        const state = getApplicationState(application);
        const context = yield* Layer.build(state.layer);
        const runtime = yield* FiberSet.makeRuntimePromise<never>().pipe(
          Effect.provideContext(context),
        );
        const identity = getERSCIdentity(application);
        const value = yield* Effect.promise(() =>
          identity.renderRuntime.bind(runtime, [], () =>
            state.routes[0].page.component({ params: { _tag: 'Decoded', value: {} } }),
          ),
        );
        expect(value).toBe('standalone');
      }).pipe(Effect.provide(HttpRouter.layer), Effect.scoped),
  );
});
