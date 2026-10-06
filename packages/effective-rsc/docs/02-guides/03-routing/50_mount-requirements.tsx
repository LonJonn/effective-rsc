/**
 * # Mount a module with a service requirement
 *
 * The module consumes an Organization service. It does not know where that service's id comes
 * from. Its Page parameters describe only its own local URLs.
 */
import { Context, Effect, Layer, Schema } from 'effect';
import { Application } from 'effective-rsc';

class Organization extends Context.Service<Organization, { readonly id: string }>()(
  'example/Organization',
) {}

const ERSC = Application.ersc();
const Todos = ERSC.withRequirements<Organization>();
const Shell = ERSC.Layout.make({
  render: ({ children }) =>
    Effect.succeed(
      <html lang='en'>
        <body>{children}</body>
      </html>,
    ),
});
const Index = Todos.Page.make({
  render: () => Effect.map(Organization, (organization) => <h1>Todos for {organization.id}</h1>),
});
const Todo = Todos.Page.make({
  params: Schema.Struct({ todoId: Schema.String }),
  render: ({ params }) =>
    Effect.map(Organization, (organization) => (
      <p>
        {organization.id}/{params.todoId}
      </p>
    )),
});
const todosRoutes = Todos.Routes.make().page('/', Index).page('/items/:todoId', Todo);

export const standalone = ERSC.make({
  routes: Todos.Routes.make({ layout: Shell }).mount('/', todosRoutes),
  layer: Layer.succeed(Organization, { id: 'my-organization' }),
});

export const mounted = ERSC.make({
  routes: ERSC.Routes.make({ layout: Shell }).mount('/orgs/:orgId/todos', todosRoutes, {
    params: Schema.Struct({ orgId: Schema.String }),
    provide: ({ params }) => Effect.succeed(Context.make(Organization, { id: params.orgId })),
  }),
});
