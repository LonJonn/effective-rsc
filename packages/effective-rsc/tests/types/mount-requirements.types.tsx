import { Context, Effect, Layer, Schema } from 'effect';

import { Application } from '../../src/application/ersc';
import type { LayoutComponent } from '../../src/application/layout';
import type { StaticPageDefinition } from '../../src/application/page';

class Organization extends Context.Service<Organization, { readonly id: string }>()(
  'Organization',
) {}
class Other extends Context.Service<Other, { readonly name: string }>()('Other') {}
const ERSC = Application.ersc();
const Todos = ERSC.withRequirements<Organization>();
const Shell = ERSC.Layout.make({ render: ({ children }) => Effect.succeed(children) });
const TodoPage = Todos.Page.make({
  params: Schema.Struct({ todoId: Schema.String }),
  render: ({ params }) =>
    Effect.map(Organization, (org) => (
      <p>
        {org.id}/{params.todoId}
      </p>
    )),
});
const Index = Todos.Page.make({ render: () => Effect.map(Organization, (org) => <p>{org.id}</p>) });
const todosRoutes = Todos.Routes.make({ layout: Shell })
  .page('/', Index)
  .page('/items/:todoId', TodoPage);
ERSC.make({ routes: todosRoutes, layer: Layer.succeed(Organization, { id: 'independent' }) });
// @ts-expect-error The root must provide the child's service requirement.
ERSC.make({ routes: todosRoutes });
// @ts-expect-error An unrelated service does not satisfy the requirement.
ERSC.make({ routes: todosRoutes, layer: Layer.succeed(Other, { name: 'wrong' }) });
const routes = ERSC.Routes.make({ layout: Shell }).mount('/orgs/:orgId/todos', todosRoutes, {
  params: Schema.Struct({ orgId: Schema.String }),
  provide: ({ params }) => Effect.succeed(Context.make(Organization, { id: params.orgId })),
});
ERSC.make({ routes });
const nested = ERSC.Routes.make().mount('/todos', todosRoutes);
const bound = ERSC.Routes.make({ layout: Shell }).mount('/orgs/:orgId', nested, {
  params: Schema.Struct({ orgId: Schema.String }),
  provide: ({ params }) => Effect.succeed(Context.make(Organization, { id: params.orgId })),
});
ERSC.make({ routes: bound });
const unresolved = ERSC.Routes.make({ layout: Shell }).mount('/todos', todosRoutes);
// @ts-expect-error Static composition preserves unresolved service requirements.
ERSC.make({ routes: unresolved });
const wrong = ERSC.Routes.make({ layout: Shell }).mount('/orgs/:orgId', todosRoutes, {
  params: Schema.Struct({ orgId: Schema.String }),
  provide: () => Effect.succeed(Context.make(Other, { name: 'wrong' })),
});
// @ts-expect-error A mount providing an unrelated service leaves Organization required.
ERSC.make({ routes: wrong });
// @ts-expect-error The mount Schema must match its own encoded capture names.
ERSC.Routes.make().mount('/orgs/:orgId', todosRoutes, {
  params: Schema.Struct({ organization: Schema.String }),
  provide: () => Effect.succeed(Context.make(Organization, { id: 'wrong' })),
});
// @ts-expect-error Duplicate captures across composition are ambiguous.
ERSC.Routes.make().mount('/orgs/:todoId', todosRoutes, {
  params: Schema.Struct({ todoId: Schema.String }),
  provide: ({ params }) => Effect.succeed(Context.make(Organization, { id: params.todoId })),
});
const movedPage = ERSC.Routes.make({ layout: Shell }).page('/', Index);
// @ts-expect-error Moving a Page out of its authoring view retains its requirements.
ERSC.make({ routes: movedPage });
// @ts-expect-error Route-only services are unavailable on independent Server Function queries.
Todos.ServerFn.make({
  handler: () => Effect.map(Organization, (org) => org.id),
});
const Constant = ERSC.Routes.make({ layout: Shell }).mount('/todos', todosRoutes, {
  params: Schema.Struct({}),
  provide: () => Effect.succeed(Context.make(Organization, { id: 'constant' })),
});
ERSC.make({ routes: Constant });
const OrganizationMiddleware = ERSC.Middleware.make<{ provides: Organization }>((effect) =>
  effect.pipe(Effect.provideService(Organization, { id: 'middleware' })),
);
ERSC.make({
  routes: ERSC.withMiddleware(OrganizationMiddleware)
    .Routes.make({ layout: Shell })
    .mount('/todos', todosRoutes),
});
const Fulfilled = Todos.withMiddleware(OrganizationMiddleware);
ERSC.make({ routes: Fulfilled.Routes.make({ layout: Shell }).page('/', Index) });
const RequiredLayout = Todos.Layout.make({
  render: ({ children }) => Effect.map(Organization, () => children),
});
const layoutRoutes = ERSC.Routes.make({ layout: RequiredLayout }).page(
  '/',
  ERSC.Page.make({ render: () => Effect.succeed(null) }),
);
// @ts-expect-error Moving a Layout also retains its requirements.
ERSC.make({ routes: layoutRoutes });

Fulfilled.ServerFn.make({ handler: () => Effect.map(Organization, (org) => org.id) });
const Global = Application.ersc<Organization>();
Global.withRequirements<Organization>().ServerFn.make({
  handler: () => Effect.map(Organization, (org) => org.id),
});
const leafRoutes = Todos.Routes.make().page('/:todoId', TodoPage);
ERSC.make({
  routes: ERSC.Routes.make({ layout: Shell }).mount('/orgs/:orgId/todos', leafRoutes, {
    params: Schema.Struct({ orgId: Schema.FiniteFromString }),
    provide: ({ params }) => {
      const id: number = params.orgId;
      return Effect.succeed(Context.make(Organization, { id: String(id) }));
    },
  }),
});
ERSC.Routes.make().mount('/orgs/:orgId', todosRoutes, {
  params: Schema.Struct({ orgId: Schema.String }),
  // @ts-expect-error An adapter cannot silently introduce unavailable provider dependencies.
  provide: () => Effect.map(Other, (other) => Context.make(Organization, { id: other.name })),
});
ERSC.Routes.make().mount('/orgs/:orgId', todosRoutes, {
  params: Schema.Struct({ orgId: Schema.String }),
  // @ts-expect-error Adapter expected failures must be handled before returning a Context.
  provide: () => Effect.fail('failed'),
});

// @ts-expect-error A Page requirement cannot be erased by assigning a service-free Page type.
const erasedPage: StaticPageDefinition<never> = Index;
void erasedPage;
// @ts-expect-error A Layout requirement cannot be erased by assigning a service-free Layout type.
const erasedLayout: LayoutComponent<never> = RequiredLayout;
void erasedLayout;
