/* oxlint-disable effecttsgo/async-function, effecttsgo/node-builtin-import -- Standalone Bun documentation generator. */
import { readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

const repositoryRoot = Bun.fileURLToPath(new URL('../', import.meta.url));
export const documentationRoot = join(repositoryRoot, 'packages/effective-rsc/docs');
export const documentationOutput = join(repositoryRoot, 'packages/effective-rsc/LLMS.md');
const documentationOutputDirectory = dirname(documentationOutput);

const directoryToMarkdown = async (directory: string, depth: number): Promise<string> => {
  const sections: Array<string> = [];
  const indexPath = join(directory, 'index.md');
  const index = Bun.file(indexPath);
  let childDepth = depth;

  if (await index.exists()) {
    const source = await index.text();
    const heading = source.match(/^#{1,6} (.+)\r?\n/);
    if (heading === null) {
      throw new Error(`Missing documentation heading: ${relative(repositoryRoot, indexPath)}`);
    }

    const title = heading[1]!.trim();
    const href = `./${relative(documentationOutputDirectory, indexPath).replaceAll('\\', '/')}`;
    const link = `[${title}](${href})`;
    // An opening blockquote describes when to use the documented API.
    const summary = source
      .slice(heading[0].length)
      .trimStart()
      .match(/^(?:> [^\r\n]+(?:\r?\n|$))+/)?.[0]
      .replace(/^> /gm, '')
      .replace(/\s+/g, ' ')
      .trim();
    const entry = summary === undefined ? link : `${link}: ${summary}`;

    sections.push(
      depth === 0 ? link : depth === 1 ? `## ${link}` : `${'  '.repeat(depth - 2)}- ${entry}`,
    );
    childDepth += 1;
  }

  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, 'en', { numeric: true }));
  for (const entry of entries) {
    const section = await directoryToMarkdown(join(directory, entry.name), childDepth);
    if (section !== '') {
      sections.push(section);
    }
  }

  return sections.join(depth < 2 ? '\n\n' : '\n');
};

export const generateDocumentation = async () => {
  const index = await directoryToMarkdown(documentationRoot, 0);
  return `${[
    '# effective-rsc',
    'Read the relevant docs before changing framework usage. Links point to documentation and examples shipped with this package version.',
    index,
  ].join('\n\n')}\n`;
};

const main = async () => {
  const arguments_ = Bun.argv.slice(2);
  if (arguments_.some((argument) => argument !== '--check')) {
    throw new Error(`Unknown documentation generator argument: ${arguments_.join(' ')}`);
  }

  const generated = await generateDocumentation();
  if (arguments_.includes('--check')) {
    const current = await Bun.file(documentationOutput).text();
    if (current !== generated) {
      throw new Error('packages/effective-rsc/LLMS.md is stale. Run `bun run docs:generate`.');
    }
    return;
  }
  await Bun.write(documentationOutput, generated);
};

if (import.meta.main) {
  await main();
}
