import { Context, Effect, Schema, type Types } from 'effect';
import { HttpRouter, HttpServerResponse } from 'effect/unstable/http';

import {
  type ERSCIdentity,
  ERSCIdentityTypeId,
  ERSCMemberKindTypeId,
  type ERSCStatefulMember,
  ERSCStateTypeId,
  getERSCIdentity,
  isERSCMember,
} from './ersc-identity';
import type { LayoutComponent } from './layout';
import type { LoadingComponent } from './loading';
import { type AnyMiddleware, makeMiddlewareFactory } from './middleware';
import {
  type AnyPageDefinition,
  getPageState,
  type PageConcern,
  type PageParamsSchema,
  type PageParamKeys,
  type ValidPageParamsSchema,
} from './page';
import type { RequirementsOf, ServiceRequirements } from './requirements';
import {
  type AbsolutePath,
  analyzeRoutePath,
  joinRoutePaths,
  type JoinPath,
  type RouteParamNames,
  type RouteShape,
  type ValidRoutePath,
} from './route-path';

declare const RoutesContractTypeId: unique symbol;

type RoutesState<
  HasLayout extends boolean,
  Paths extends AbsolutePath,
  Shapes extends AbsolutePath,
> = {
  readonly hasLayout: Types.Covariant<HasLayout>;
  readonly paths: Types.Covariant<Paths>;
  readonly shapes: Types.Covariant<Shapes>;
};

type MountedPaths<Prefix extends AbsolutePath, Child> =
  RoutesPaths<Child> extends infer Path extends AbsolutePath ? JoinPath<Prefix, Path> : never;

type NoPathCollision<CurrentShapes extends AbsolutePath, Added extends AbsolutePath> = [
  Extract<RouteShape<Added>, CurrentShapes>,
] extends [never]
  ? unknown
  : never;

type PageParamNames<Page> =
  Page extends PageConcern<infer ParamNames, infer _Mode> ? ParamNames : never;

type PageMode<Page> = Page extends PageConcern<infer _ParamNames, infer Mode> ? Mode : never;

type ExactPageParamNames<Path extends AbsolutePath, Page> = [RouteParamNames<Path>] extends [
  PageParamNames<Page>,
]
  ? [PageParamNames<Page>] extends [RouteParamNames<Path>]
    ? unknown
    : never
  : never;

type MatchingPageParams<Path extends AbsolutePath, Page> =
  PageMode<Page> extends 'Static'
    ? [RouteParamNames<Path>] extends [never]
      ? unknown
      : never
    : PageMode<Page> extends 'Parameterized'
      ? [RouteParamNames<Path>] extends [never]
        ? never
        : ExactPageParamNames<Path, Page>
      : never;

type StaticMountPath<Path extends AbsolutePath> = [RouteParamNames<Path>] extends [never]
  ? unknown
  : never;

type MountAdapter<Services, Params extends PageParamsSchema<Services>, Provided> = {
  readonly params: Params;
  readonly provide: (props: {
    readonly params: Params['Type'];
  }) => Effect.Effect<Context.Context<Provided>, never, Services>;
};

type MatchingMountParams<Path extends AbsolutePath, Params> = [RouteParamNames<Path>] extends [
  PageParamKeys<Params>,
]
  ? [PageParamKeys<Params>] extends [RouteParamNames<Path>]
    ? [RouteParamNames<Path>] extends [never]
      ? unknown
      : ValidPageParamsSchema<Params>
    : never
  : never;

type ValidMountedPaths<Prefix extends AbsolutePath, Child> = [
  InvalidMountedPath<MountedPaths<Prefix, Child>>,
] extends [never]
  ? unknown
  : never;
type InvalidMountedPath<Path extends AbsolutePath> =
  Path extends ValidRoutePath<Path> ? never : Path;

type KnownNonEmptyRoutes<Definition> =
  AbsolutePath extends RoutesPaths<Definition>
    ? never
    : [RoutesPaths<Definition>] extends [never]
      ? never
      : unknown;

export interface RoutesDefinition<
  Services,
  out HasLayout extends boolean,
  out Paths extends AbsolutePath,
  // Retain each matcher shape so additions do not recompute every earlier path's shape.
  out Shapes extends AbsolutePath = RouteShape<Paths>,
  out Requirements = never,
  AvailableServices = Services,
>
  extends
    ERSCStatefulMember<Services, 'Routes', RoutesImplementationState<Services>>,
    ServiceRequirements<Requirements> {
  readonly [RoutesContractTypeId]: RoutesState<HasLayout, Paths, Shapes>;

  page<const Path extends AbsolutePath, const Page extends AnyPageDefinition<Services>>(
    path: Path & ValidRoutePath<Path> & NoPathCollision<Shapes, Path>,
    page: Page & MatchingPageParams<Path, Page>,
  ): RoutesDefinition<
    Services,
    HasLayout,
    Paths | Path,
    Shapes | RouteShape<Path>,
    Requirements | Exclude<RequirementsOf<Page>, AvailableServices>,
    AvailableServices
  >;

  mount<const Prefix extends AbsolutePath, const Child extends AnyRoutes<Services>>(
    path: Prefix & ValidRoutePath<Prefix> & StaticMountPath<Prefix>,
    routes: Child &
      KnownNonEmptyRoutes<Child> &
      NoPathCollision<Shapes, MountedPaths<Prefix, Child>> &
      ValidMountedPaths<Prefix, Child>,
  ): RoutesDefinition<
    Services,
    HasLayout,
    Paths | MountedPaths<Prefix, Child>,
    Shapes | RouteShape<MountedPaths<Prefix, Child>>,
    Requirements | Exclude<RequirementsOf<Child>, AvailableServices>,
    AvailableServices
  >;

  mount<
    const Prefix extends AbsolutePath,
    const Child extends AnyRoutes<Services>,
    Params extends PageParamsSchema<AvailableServices>,
    Provided,
  >(
    path: Prefix & ValidRoutePath<Prefix>,
    routes: Child &
      KnownNonEmptyRoutes<Child> &
      NoPathCollision<Shapes, MountedPaths<Prefix, Child>> &
      ValidMountedPaths<Prefix, Child>,
    adapter: MountAdapter<AvailableServices, Params, Provided> &
      MatchingMountParams<Prefix, Params>,
  ): RoutesDefinition<
    Services,
    HasLayout,
    Paths | MountedPaths<Prefix, Child>,
    Shapes | RouteShape<MountedPaths<Prefix, Child>>,
    Requirements | Exclude<RequirementsOf<Child>, AvailableServices | Provided>,
    AvailableServices
  >;
}

export type AnyRoutes<Services> = RoutesDefinition<
  Services,
  boolean,
  AbsolutePath,
  AbsolutePath,
  unknown,
  unknown
>;

export type RoutesHasLayout<Definition> =
  Definition extends RoutesDefinition<
    infer _Services,
    infer HasLayout,
    infer _Paths,
    infer _Shapes,
    infer _Requirements,
    infer _Available
  >
    ? HasLayout
    : never;

export type RoutesPaths<Definition> =
  Definition extends RoutesDefinition<
    infer _Services,
    infer _HasLayout,
    infer Paths,
    infer _Shapes,
    infer _Requirements,
    infer _Available
  >
    ? Paths
    : never;

type RoutesPage<Services> = {
  readonly page: AnyPageDefinition<Services>;
  readonly path: AbsolutePath;
};

type RoutesMount<Services> = {
  readonly path: AbsolutePath;
  readonly routes: AnyRoutes<Services>;
  readonly middleware: AnyMiddleware<Services> | null;
};

export type RoutesImplementationState<Services> = {
  readonly layout: LayoutComponent<Services, unknown> | null;
  readonly loading: LoadingComponent<Services> | null;
  readonly middleware: ReadonlyArray<AnyMiddleware<Services>>;
  readonly mounts: ReadonlyArray<RoutesMount<Services>>;
  readonly pages: ReadonlyArray<RoutesPage<Services>>;
  readonly paths: ReadonlyArray<AbsolutePath>;
  readonly scopeId: number;
};

type RoutesOptions<Services> = {
  readonly layout?: LayoutComponent<Services, unknown>;
  readonly loading?: LoadingComponent<Services>;
};

type HasLayoutFromOptions<Options> = Options extends { readonly layout: unknown } ? true : false;

type RuntimeRoutesOptions<Services> = RoutesImplementationState<Services> & {
  readonly routeShapes: ReadonlySet<string>;
};

class RoutesDefinitionImpl<
  Services,
  HasLayout extends boolean,
  Paths extends AbsolutePath,
  Shapes extends AbsolutePath = RouteShape<Paths>,
  Requirements = never,
  AvailableServices = Services,
> implements RoutesDefinition<Services, HasLayout, Paths, Shapes, Requirements, AvailableServices> {
  declare readonly [RoutesContractTypeId]: RoutesState<HasLayout, Paths, Shapes>;
  readonly [ERSCIdentityTypeId]: ERSCIdentity<Services>;
  readonly [ERSCMemberKindTypeId] = 'Routes' as const;
  get [ERSCStateTypeId](): RoutesImplementationState<Services> {
    return this;
  }

  readonly layout: LayoutComponent<Services, unknown> | null;
  readonly loading: LoadingComponent<Services> | null;
  readonly middleware: ReadonlyArray<AnyMiddleware<Services>>;
  readonly mounts: ReadonlyArray<RoutesMount<Services>>;
  readonly pages: ReadonlyArray<RoutesPage<Services>>;
  readonly paths: ReadonlyArray<AbsolutePath>;
  readonly scopeId: number;
  readonly #routeShapes: ReadonlySet<string>;

  constructor(
    identity: ERSCIdentity<Services>,
    {
      layout,
      loading,
      middleware,
      mounts,
      pages,
      paths,
      routeShapes,
      scopeId,
    }: RuntimeRoutesOptions<Services>,
  ) {
    this[ERSCIdentityTypeId] = identity;
    this.layout = layout;
    this.loading = loading;
    this.middleware = middleware;
    this.mounts = mounts;
    this.pages = pages;
    this.paths = paths;
    this.scopeId = scopeId;
    this.#routeShapes = routeShapes;
    Object.freeze(this);
  }

  page<const Path extends AbsolutePath, const Page extends AnyPageDefinition<Services>>(
    path: Path & ValidRoutePath<Path> & NoPathCollision<Shapes, Path>,
    page: Page & MatchingPageParams<Path, Page>,
  ): RoutesDefinitionImpl<
    Services,
    HasLayout,
    Paths | Path,
    Shapes | RouteShape<Path>,
    Requirements | Exclude<RequirementsOf<Page>, AvailableServices>,
    AvailableServices
  > {
    const route = analyzeRoutePath(path);
    if (this.#routeShapes.has(route.shape)) {
      throw new TypeError(`Route "${path}" conflicts with an existing route pattern.`);
    }
    const pageState = getPageState(page);
    if (getERSCIdentity(page) !== this[ERSCIdentityTypeId]) {
      throw new TypeError(`Page for "${path}" was created by a different ERSC module.`);
    }

    if (route._tag === 'ParameterFree' && pageState.paramsSchema !== null) {
      throw new TypeError(`Parameterized Page for "${path}" requires route parameters.`);
    }
    if (route._tag === 'Parameterized' && pageState.paramsSchema === null) {
      throw new TypeError(`Page for "${path}" must declare a parameter Schema.`);
    }

    const routeShapes = new Set(this.#routeShapes);
    routeShapes.add(route.shape);

    return new RoutesDefinitionImpl(this[ERSCIdentityTypeId], {
      layout: this.layout,
      loading: this.loading,
      middleware: this.middleware,
      mounts: this.mounts,
      pages: Object.freeze([...this.pages, Object.freeze({ page, path })]),
      paths: Object.freeze([...this.paths, path]),
      routeShapes,
      scopeId: this.scopeId,
    });
  }

  mount<const Prefix extends AbsolutePath, const Child extends AnyRoutes<Services>>(
    path: Prefix & ValidRoutePath<Prefix> & StaticMountPath<Prefix>,
    routes: Child &
      KnownNonEmptyRoutes<Child> &
      NoPathCollision<Shapes, MountedPaths<Prefix, Child>> &
      ValidMountedPaths<Prefix, Child>,
  ): RoutesDefinition<
    Services,
    HasLayout,
    Paths | MountedPaths<Prefix, Child>,
    Shapes | RouteShape<MountedPaths<Prefix, Child>>,
    Requirements | Exclude<RequirementsOf<Child>, AvailableServices>,
    AvailableServices
  >;

  mount<
    const Prefix extends AbsolutePath,
    const Child extends AnyRoutes<Services>,
    Params extends PageParamsSchema<AvailableServices>,
    Provided,
  >(
    path: Prefix & ValidRoutePath<Prefix>,
    routes: Child &
      KnownNonEmptyRoutes<Child> &
      NoPathCollision<Shapes, MountedPaths<Prefix, Child>> &
      ValidMountedPaths<Prefix, Child>,
    adapter: MountAdapter<AvailableServices, Params, Provided> &
      MatchingMountParams<Prefix, Params>,
  ): RoutesDefinition<
    Services,
    HasLayout,
    Paths | MountedPaths<Prefix, Child>,
    Shapes | RouteShape<MountedPaths<Prefix, Child>>,
    Requirements | Exclude<RequirementsOf<Child>, AvailableServices | Provided>,
    AvailableServices
  >;
  mount<Params extends PageParamsSchema<AvailableServices>, Provided>(
    path: AbsolutePath,
    routes: AnyRoutes<Services>,
    adapter?: MountAdapter<AvailableServices, Params, Provided>,
  ): unknown {
    const route = analyzeRoutePath(path);
    if (route._tag === 'Parameterized' && adapter === undefined) {
      throw new TypeError(
        `Parameterized mount "${path}" requires a parameter Schema and service adapter.`,
      );
    }
    const mountMiddleware =
      adapter === undefined
        ? null
        : makeMiddlewareFactory<Services, AvailableServices>(this[ERSCIdentityTypeId]).make<{
            provides: Provided;
          }>((httpEffect) =>
            Effect.gen(function* () {
              const allParams = yield* HttpRouter.params;
              const names = route._tag === 'Parameterized' ? route.parameterNames : [];
              const params = Object.fromEntries(names.map((name) => [name, allParams[name]]));
              const decoded = yield* Schema.decodeEffect(adapter.params)(params).pipe(
                Effect.option,
              );
              if (decoded._tag === 'None') {
                return HttpServerResponse.empty({
                  status: 404,
                  headers: { 'cache-control': 'private, no-store', vary: 'Accept' },
                });
              }
              const context = yield* adapter.provide({ params: decoded.value });
              return yield* httpEffect.pipe(Effect.provideContext(context));
            }),
          );
    const routesState = getRoutesState(routes);
    if (routesState.paths.length === 0) {
      throw new TypeError(`Cannot mount empty Routes at "${path}".`);
    }
    if (getERSCIdentity(routes) !== this[ERSCIdentityTypeId]) {
      throw new TypeError(`Routes mounted at "${path}" were created by a different ERSC module.`);
    }

    const mountedPaths = routesState.paths.map((childPath) => joinRoutePaths(path, childPath));
    const routeShapes = new Set(this.#routeShapes);
    for (const mountedPath of mountedPaths) {
      const shape = analyzeRoutePath(mountedPath).shape;
      if (routeShapes.has(shape)) {
        throw new TypeError(`Route "${mountedPath}" conflicts with an existing route pattern.`);
      }
      routeShapes.add(shape);
    }

    return new RoutesDefinitionImpl(this[ERSCIdentityTypeId], {
      layout: this.layout,
      loading: this.loading,
      middleware: this.middleware,
      mounts: Object.freeze([
        ...this.mounts,
        Object.freeze({ path, routes, middleware: mountMiddleware }),
      ]),
      pages: this.pages,
      paths: Object.freeze([...this.paths, ...mountedPaths]),
      routeShapes,
      scopeId: this.scopeId,
    });
  }
}

export const getRoutesState = <Services>(
  routes: AnyRoutes<Services>,
): RoutesImplementationState<Services> => {
  if (!isERSCMember(routes, 'Routes')) {
    throw new TypeError('Routes must be created with ERSC.Routes.make.');
  }
  return routes[ERSCStateTypeId];
};

export type RoutesFactory<Services, AvailableServices = Services, Requirements = never> = {
  readonly make: {
    (): RoutesDefinition<Services, false, never, never, Requirements, AvailableServices>;
    <Options extends RoutesOptions<Services>>(
      options: Options,
    ): RoutesDefinition<
      Services,
      HasLayoutFromOptions<Options>,
      never,
      never,
      | Requirements
      | Exclude<
          RequirementsOf<Options extends { readonly layout: infer Layout } ? Layout : never>,
          AvailableServices
        >,
      AvailableServices
    >;
  };
};

export const makeRoutesFactory = <Services, AvailableServices = Services, Requirements = never>(
  identity: ERSCIdentity<Services>,
  middleware: ReadonlyArray<AnyMiddleware<Services>>,
  allocateScopeId: () => number,
): RoutesFactory<Services, AvailableServices, Requirements> => {
  function make(): RoutesDefinition<Services, false, never, never, Requirements, AvailableServices>;
  function make<Options extends RoutesOptions<Services>>(
    options: Options,
  ): RoutesDefinition<
    Services,
    HasLayoutFromOptions<Options>,
    never,
    never,
    | Requirements
    | Exclude<
        RequirementsOf<Options extends { readonly layout: infer Layout } ? Layout : never>,
        AvailableServices
      >,
    AvailableServices
  >;
  function make(options: RoutesOptions<Services> = {}): AnyRoutes<Services> {
    if (options.layout !== undefined) {
      if (!isERSCMember(options.layout, 'Layout')) {
        throw new TypeError('Layout must be created with ERSC.Layout.make.');
      }
      if (getERSCIdentity(options.layout) !== identity) {
        throw new TypeError('Layout was created by a different ERSC module.');
      }
    }
    if (options.loading !== undefined) {
      if (!isERSCMember(options.loading, 'Loading')) {
        throw new TypeError('Loading must be created with ERSC.Loading.make.');
      }
      if (getERSCIdentity(options.loading) !== identity) {
        throw new TypeError('Loading was created by a different ERSC module.');
      }
    }
    const scopeId = allocateScopeId();

    return new RoutesDefinitionImpl(identity, {
      layout: options.layout ?? null,
      loading: options.loading ?? null,
      middleware,
      mounts: Object.freeze([]),
      pages: Object.freeze([]),
      paths: Object.freeze([]),
      routeShapes: new Set(),
      scopeId,
    });
  }

  return { make };
};
