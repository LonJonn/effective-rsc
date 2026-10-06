## Routes

> Use Routes to connect URLs to pages and group them under layouts, loading fallbacks, and middleware.

`ERSC.Routes.make({ layout?, loading? })` creates a route scope. Its methods return new Routes:

- `page(path, page)` adds a Page at an absolute Effect HTTP pattern. Parameter Schema keys must
  exactly match path parameters.
- `mount(prefix, childRoutes)` mounts non-empty Routes from the same application below an absolute,
  parameter-free prefix, retaining Layout, Loading, and middleware ancestry and unresolved services.
- `mount(prefix, childRoutes, { params, provide })` also accepts parameterized prefixes. `params`
  is a Schema whose encoded keys exactly match the prefix's captures. `provide({ params })` receives
  the decoded values and returns an Effect Context through an Effect with no typed failures.
  Its service requirements must be available in the parent authoring view. The services it returns
  satisfy corresponding child requirements. Schema rejection returns an empty `404`.

`ERSC.withRequirements<Services>()` declares module dependencies and makes them available while
writing Page, Layout, and Component effects. Its Routes carry those requirements without adding URL
parameters. Unresolved requirements must be supplied by the root application Layer. A static
adapter can use an empty Struct Schema. Middleware-provided services also satisfy requirements.
Pages and Layouts retain their declared requirements when attached through another authoring view.

Conflicting matcher shapes and the `/_ersc` namespace are rejected. The root Routes must have a
Layout and at least one Page. Routes created from a `withMiddleware` view activate that middleware.

<!-- source-navigation -->

### Related

- [Middleware](../06-middleware/index.md)
