# effective-rsc

Read the relevant docs before changing framework usage. Links point to documentation and examples shipped with this package version.

[effective-rsc documentation](./docs/index.md)

## [Getting started](./docs/01-getting-started/index.md)

## [Guides](./docs/02-guides/index.md)

- [Server Functions](./docs/02-guides/01-server-functions/index.md)

- [Services](./docs/02-guides/02-services/index.md)

- [Routing, parameters, and loading](./docs/02-guides/03-routing/index.md)

- [Middleware](./docs/02-guides/04-middleware/index.md)

- [Userland HTTP](./docs/02-guides/05-http/index.md)

- [Deploying to Vercel](./docs/02-guides/06-deploying-to-vercel/index.md)

## [Advanced](./docs/03-advanced/index.md)

- [Resources and cancellation](./docs/03-advanced/01-request-runtime-and-lifetimes/index.md)

- [Client navigation](./docs/03-advanced/02-client-navigation/index.md)

- [Results and route refresh](./docs/03-advanced/03-server-function-execution-and-refresh/index.md)

- [Production startup](./docs/03-advanced/04-production-startup/index.md)

## [API reference](./docs/04-api-reference/index.md)

- [Application](./docs/04-api-reference/01-application/index.md): Use Application to connect your routes and shared services in `src/application.tsx`.

- [Page](./docs/04-api-reference/02-page/index.md): Use Page to render the content for a URL and read its path parameters.

- [Layout](./docs/04-api-reference/03-layout/index.md): Use Layout for UI shared by several pages, such as navigation and the HTML document.

- [Loading](./docs/04-api-reference/04-loading/index.md): Use Loading to show a fallback while pages or components below a layout are loading.

- [Component](./docs/04-api-reference/05-component/index.md): Use Component for a reusable Server Component that renders with Effect or reads services.

- [Middleware](./docs/04-api-reference/06-middleware/index.md): Use Middleware for authentication, request checks, or services needed by selected routes and Server Functions.

- [Routes](./docs/04-api-reference/07-routes/index.md): Use Routes to connect URLs to pages and group them under layouts, loading fallbacks, and middleware.

- [ServerFn](./docs/04-api-reference/08-server-fn/index.md): Use ServerFn to define server work called by browser code or submitted through a form.

- [Client queries and streams](./docs/04-api-reference/09-client-queries-and-streams/index.md): Use query helpers to read server data without refreshing the page, stream helpers for incoming chunks, and atom helpers to display those results in React.
