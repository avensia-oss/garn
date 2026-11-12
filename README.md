# Garn

Garn is a base library for creating a build system. It contains a system for running tasks.

Why the name Garn? No reason really, we just wanted a short name that's easy to communicate. It's a Swedishified word play on yarn which is used for NPM dependencies.

## Requirements

Use Node.js 24.15 or newer. `.nvmrc` pins the latest Node release for development.
TypeScript >=5 is a peer dependency for the `typescript.typecheck` helper;
Garn does not install its own runtime compiler.

## Buildsystem

Create `buildsystem/index.mts`:

```mts
import { task } from '@avensia-oss/garn';
import { message } from './message.mts';

task('hello', () => console.log(message));
```

Run `garn hello`. Node runs the `.mts` sources directly; Garn no longer compiles
the buildsystem, rewrites imports, or generates a compilation manifest.
`.buildcache` is used only for task metadata and package-restore bookkeeping.

When migrating an existing buildsystem:

- Rename TypeScript files to `.mts`, including `buildsystem/index.mts`.
- Use explicit `.mts` extensions for local imports and `import type` for types.
- Replace `tsconfig` path aliases with relative imports or Node package imports.
- Use erasable TypeScript syntax: JSX, enums, parameter properties, and runtime
  namespaces are not supported by Node's native type stripping.
- Replace CommonJS globals with `import.meta.dirname` and `import.meta.filename`.
- Remove `--compile-buildsystem`; it is no longer needed.

Node does not read `tsconfig.json` or type-check at runtime. Type-check separately
with `tsc --noEmit` (or Garn's `typescript.typecheck` helper). A suitable buildsystem
configuration uses `module: "nodenext"`, `target: "esnext"`,
`allowImportingTsExtensions: true`, `verbatimModuleSyntax: true`,
`erasableSyntaxOnly: true`, and `noEmit: true`.

Garn itself is published as compiled ESM JavaScript because Node does not strip
TypeScript in `node_modules`. Its source files use `.mts` and compile to `.mjs`.

## Changelog

Read the changelog [here](CHANGELOG.md).
