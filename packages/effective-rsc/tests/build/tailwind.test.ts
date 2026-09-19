import * as BunServices from '@effect/platform-bun/BunServices';
import { expect, it } from '@effect/vitest';
import { Effect, FileSystem, Logger, Path, Schema } from 'effect';

import { resolveTailwindToolchain, TailwindToolchainError } from '../../src/build/tailwind';

const json = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
const fixture = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspace = yield* fileSystem.makeTempDirectoryScoped({ prefix: 'ersc-tailwind-' });
  const root = path.join(workspace, 'application');
  const manifest = Effect.fnUntraced(function* (value: unknown) {
    const encoded = yield* json(value);
    yield* fileSystem.makeDirectory(root, { recursive: true });
    yield* fileSystem.writeFileString(path.join(root, 'package.json'), encoded);
  });
  const installLoader = Effect.fnUntraced(function* () {
    const directory = path.join(workspace, 'node_modules/@tailwindcss/webpack');
    const encoded = yield* json({ name: '@tailwindcss/webpack', main: './index.js' });
    yield* fileSystem.makeDirectory(directory, { recursive: true });
    yield* fileSystem.writeFileString(path.join(directory, 'package.json'), encoded);
    yield* fileSystem.writeFileString(path.join(directory, 'index.js'), 'export default {};');

    return path.join(directory, 'index.js');
  });

  return { fileSystem, path, root, manifest, installLoader };
});

it.effect('configures Tailwind when the application declares both packages', () =>
  Effect.gen(function* () {
    const { root, manifest, installLoader } = yield* fixture;
    const loader = yield* installLoader();

    yield* manifest({
      dependencies: { 'effective-rsc': '*', tailwindcss: '4.3.3' },
      devDependencies: { '@tailwindcss/webpack': '4.3.3' },
    });

    const toolchain = yield* resolveTailwindToolchain(root);

    expect(toolchain).toEqual({ loader });
  }).pipe(Effect.provide(BunServices.layer), Effect.scoped),
);

it.effect('leaves Tailwind unconfigured when the application declares neither package', () => {
  const messages: Array<string> = [];
  const logger = Logger.make(({ message }) => {
    messages.push(Bun.stripANSI(String(message)));
  });

  return Effect.gen(function* () {
    const { root, manifest, installLoader } = yield* fixture;

    // A hoisted installation must not configure Tailwind on its own.
    yield* installLoader();
    yield* manifest({ dependencies: { 'effective-rsc': '*' } });

    const toolchain = yield* resolveTailwindToolchain(root);

    expect(toolchain).toBeNull();
    expect(messages).toEqual([]);
  }).pipe(Effect.withLogger(logger), Effect.provide(BunServices.layer), Effect.scoped);
});

for (const declared of ['tailwindcss', '@tailwindcss/webpack'] as const) {
  const missing = declared === 'tailwindcss' ? '@tailwindcss/webpack' : 'tailwindcss';

  it.effect(`warns when the application declares only ${declared}`, () => {
    const messages: Array<string> = [];
    const logger = Logger.make(({ message }) => {
      messages.push(Bun.stripANSI(String(message)));
    });

    return Effect.gen(function* () {
      const { root, manifest, installLoader } = yield* fixture;

      yield* installLoader();
      yield* manifest({ devDependencies: { [declared]: '4.3.3' } });

      const toolchain = yield* resolveTailwindToolchain(root);

      expect(toolchain).toBeNull();
      expect(messages).toEqual([
        `! ${declared} is a dependency but ${missing} is not, so stylesheets compile without Tailwind. Add ${missing} to enable it.`,
      ]);
    }).pipe(Effect.withLogger(logger), Effect.provide(BunServices.layer), Effect.scoped);
  });
}

it.effect('fails when a declared Tailwind loader is not installed', () =>
  Effect.gen(function* () {
    const { root, manifest } = yield* fixture;

    yield* manifest({
      devDependencies: { '@tailwindcss/webpack': '4.3.3', tailwindcss: '4.3.3' },
    });

    const error = yield* resolveTailwindToolchain(root).pipe(Effect.flip);

    expect(error).toBeInstanceOf(TailwindToolchainError);
    expect(error.message).toContain('is not installed');
  }).pipe(Effect.provide(BunServices.layer), Effect.scoped),
);

it.effect('leaves Tailwind unconfigured when the application has no package.json', () =>
  Effect.gen(function* () {
    const { fileSystem, root } = yield* fixture;

    yield* fileSystem.makeDirectory(root, { recursive: true });

    const toolchain = yield* resolveTailwindToolchain(root);

    expect(toolchain).toBeNull();
  }).pipe(Effect.provide(BunServices.layer), Effect.scoped),
);

it.effect('fails when the application package.json cannot be read', () =>
  Effect.gen(function* () {
    const { fileSystem, path, root } = yield* fixture;

    yield* fileSystem.makeDirectory(root, { recursive: true });
    yield* fileSystem.writeFileString(path.join(root, 'package.json'), '{ "dependencies": ');

    const error = yield* resolveTailwindToolchain(root).pipe(Effect.flip);

    expect(error).toBeInstanceOf(TailwindToolchainError);
    expect(error.message).toContain('Cannot read dependencies from');
  }).pipe(Effect.provide(BunServices.layer), Effect.scoped),
);
