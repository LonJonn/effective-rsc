import { Effect, FileSystem, Path, Schema } from 'effect';

import { Terminal } from './terminal';

export type TailwindToolchain = {
  readonly loader: string;
};

export class TailwindToolchainError extends Schema.TaggedError<TailwindToolchainError>()(
  'TailwindToolchainError',
  {
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export const TailwindPackage = 'tailwindcss';
export const TailwindLoaderPackage = '@tailwindcss/webpack';

const DependencyVersions = Schema.Record(Schema.String, Schema.Unknown);
const ApplicationManifest = Schema.fromJsonString(
  Schema.Struct({
    dependencies: Schema.optionalKey(DependencyVersions),
    devDependencies: Schema.optionalKey(DependencyVersions),
  }),
);

type ApplicationManifest = typeof ApplicationManifest.Type;

const declaresDependency = (manifest: ApplicationManifest, name: string) =>
  Object.hasOwn(manifest.dependencies ?? {}, name) ||
  Object.hasOwn(manifest.devDependencies ?? {}, name);

export const resolveTailwindToolchain = Effect.fnUntraced(function* (applicationRoot: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestPath = path.join(applicationRoot, 'package.json');
  const manifestExists = yield* fileSystem.exists(manifestPath).pipe(
    Effect.mapError(
      (cause) =>
        new TailwindToolchainError({
          message: `Cannot read the application package.json at ${manifestPath}.`,
          cause,
        }),
    ),
  );

  if (!manifestExists) {
    return null;
  }

  const source = yield* fileSystem.readFileString(manifestPath).pipe(
    Effect.mapError(
      (cause) =>
        new TailwindToolchainError({
          message: `Cannot read the application package.json at ${manifestPath}.`,
          cause,
        }),
    ),
  );
  const manifest = yield* Schema.decodeEffect(ApplicationManifest)(source).pipe(
    Effect.mapError(
      (cause) =>
        new TailwindToolchainError({
          message: `Cannot read dependencies from ${manifestPath}.`,
          cause,
        }),
    ),
  );
  const declaresTailwind = declaresDependency(manifest, TailwindPackage);
  const declaresLoader = declaresDependency(manifest, TailwindLoaderPackage);

  if (!declaresTailwind || !declaresLoader) {
    if (declaresTailwind !== declaresLoader) {
      const [declared, missing] = declaresTailwind
        ? [TailwindPackage, TailwindLoaderPackage]
        : [TailwindLoaderPackage, TailwindPackage];

      yield* Effect.logWarning(
        `${Terminal.yellow('!')} ${declared} is a dependency but ${missing} is not, so stylesheets compile without Tailwind. Add ${missing} to enable it.`,
      );
    }

    return null;
  }

  const notInstalled = (cause: unknown) =>
    new TailwindToolchainError({
      message: `${TailwindLoaderPackage} is a dependency of ${manifestPath} but is not installed. Install dependencies and compile again.`,
      cause,
    });
  const loader = yield* Effect.try({
    try: () => Bun.resolveSync(TailwindLoaderPackage, applicationRoot),
    catch: notInstalled,
  });

  // Bun falls back to its global install cache, which the application never locked.
  if (!loader.split(path.sep).includes('node_modules')) {
    return yield* notInstalled(loader);
  }

  return { loader } satisfies TailwindToolchain;
});
