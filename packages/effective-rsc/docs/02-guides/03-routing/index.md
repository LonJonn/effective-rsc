## Routing, parameters, and loading

Attach a Page with `routes.page(path, page)`. Group routes under a Layout and optional Loading
fallback, then nest them with `routes.mount(prefix, childRoutes)`. Each operation returns new Routes;
mounting preserves the child's layouts, loading fallbacks, and middleware.

Define path parameters in a Page's `params` Schema. Its encoded keys must match the route's
`:parameters` and accept strings; `render` receives decoded values. A parameterized mount declares its own Schema and supplies child services through an adapter. Unmatched routes and rejected path parameters return `404`.

The root Routes needs a Layout containing the HTML document and at least one Page. A Loading
fallback is synchronous and renders below its Layout while descendants suspend.

Use `ERSC.withRequirements<Organization>()` to author a child module that consumes an Effect
service. Routes retain that requirement through composition. A parent can satisfy it with
middleware, a mount adapter, or the application Layer. The child declares no ancestor URL keys.

`mount(prefix, child, { params, provide })` decodes the mount's captures and calls `provide({ params })`
once per request. Return an Effect containing an Effect Context of the services you provide.
The encoded Schema keys must match the prefix, while `provide` receives the decoded type. An
invalid mount parameter returns an empty `404` before child middleware or rendering. For a static
adapter, use `Schema.Struct({})` and return a constant or effectfully loaded Context.

Requirements not satisfied by a mount remain in the parent graph's contract; `ERSC.make` requires
its Layer to provide them. Static intermediate mounts preserve requirements, so the adapter can
live on an outer dynamic mount. A Page's Schema sees only captures from its local Page path.
Capture names must remain unique across a complete mounted URL.

The adapter runs after ancestor middleware and before child middleware, and its services reach
rendering and Page parameter decoding. It runs during a Server Function route refresh, rather than
providing dependencies to the action itself. Server Functions require an authoring view with all service requirements satisfied, including
requirements of its retained middleware: queries execute independently of a route. Provide action dependencies through application services or
Server Function middleware.

<!-- source-navigation -->

### Examples

- [Create the ERSC identity](./10_ersc.ts)
- [Define Layout and Loading concerns](./10_layouts.tsx)
- [Define Pages](./20_pages.tsx)
- [Compose and mount Routes](./30_routes.tsx)
- [Compose the application](./40_application.ts)
- [Provide module requirements from a mount or a root Layer](./50_mount-requirements.tsx)

### Related

- [Middleware](../04-middleware/index.md)
