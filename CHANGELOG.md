# Changelog

## 0.4.5 (May 2, 2022)

Fixes to the changelog to remove erroneous brackets and use consistent reference handling.
Only show commit author and timestamp for individual commits.

## 0.4.1 (April 11, 2022)

This version _shouldn't_ contain any breaking changes, but it does include some new features and quality-of-life stuff. The main gist of these changes are to reduce the need to have garn support scripts in your project, ie. `garn.cmd`/`./garn`, and to remove the need to add `./node_modules/.bin/` to your path.

- Garn can now also be installed globally!
  When it's run globally, it will check if you have garn installed (via yarn or npm) in your current directory, and run that one instead. This means that you'll still need to have it installed in your project as well. But it removes the need to have `garn.cmd`/`./garn` scripts, that calls `node_modules/.bin/garn`, in your code.

  Install it via npm: `npm install -g garn`.

- Garn will now assume a buildsystem path of one weren't provided. I.e. you no longer need to pass `--buildsystem-path` when running garn.

- Garn will now automatically run yarn or npm (whichever is used in the project) when it is needed! So when a dependency have been added, upgraded, or removed, garn will detect this and automatically run `yarn`/`npm install` for you.

## 0.4.0 [DEPRICATED]

- Don't use. Missing vital files.

## 0.3.0 (January 20, 2022)

- Upgrade typescript from version 4.1.3 to version 4.5.4. You can read more about breaking changes in Typescript [here](https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes).
- Moved @type-dependencies to devDependencies.
