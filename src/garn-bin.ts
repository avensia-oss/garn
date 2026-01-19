#!/usr/bin/env node
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as os from 'os';
import * as childProcess from 'child_process';
import * as path from 'path';
import * as minimist from 'minimist';
import * as isInstalledGlobally from 'is-installed-globally';
import type * as typescript from 'typescript';

const execExt = os.platform() === 'win32' ? '.cmd' : '';

if (isInstalledGlobally) {
  const localGarn = path.join(process.cwd(), 'node_modules', '.bin', 'garn' + execExt);
  if (fs.existsSync(localGarn)) {
    const childGarn = childProcess.spawn(localGarn, process.argv.slice(2), {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
    });
    childGarn.on('exit', (exitCode: number) => process.exit(exitCode));
  } else {
    console.log('Error! Garn does not seem to be installed in the current working directory.');
    console.log('You are most likely executing Garn from the incorrect folder.');
    console.log('Your working directory must contain a package.json file with Garn (@avensia-oss/garn) installed.');
    process.exit(1);
  }
} else {
  const buildsystemPathArgName = 'buildsystem-path';
  if (!process.argv.find(v => v.includes(`--${buildsystemPathArgName}`))) {
    const assumedBuildsystemPath = path.join(process.cwd(), 'buildsystem');
    if (!fs.existsSync(assumedBuildsystemPath)) {
      console.log('Error! No buildsystem folder exists at:', assumedBuildsystemPath);
      console.log('You are most likely executing Garn from the incorrect folder.');
      console.log('Your working directory should contain a folder called buildsystem that contains the Garn tasks.');
      process.exit(1);
    }
    process.argv.splice(2, 0, '--' + buildsystemPathArgName, assumedBuildsystemPath);
  }

  // Add --internal-version support
  if (process.argv.includes('--internal-version') || process.argv.includes('-v')) {
    const garnPackageJsonPath = path.join(__dirname, '..', 'package.json');
    const garnPackageJson = JSON.parse(fs.readFileSync(garnPackageJsonPath).toString());
    console.log(garnPackageJson.version);
    process.exit(0);
  }

  const argv = minimist(process.argv.slice(2));

  const buildsystemPath = argv[buildsystemPathArgName];
  const buildCache = '.buildcache';
  const buildCachePath = path.join(buildsystemPath, buildCache);
  const buildCacheManifestPath = path.join(buildCachePath, '.manifest.json');
  const basePath = path.join(buildsystemPath, '..');
  let rootPath = basePath;
  if (!fs.existsSync(path.join(basePath, 'packages', 'garn.cmd'))) {
    const parentName = path.basename(path.join(basePath, '..'));
    if (parentName === 'packages') {
      rootPath = path.join(basePath, '..', '..');
    }
  }

  const yarnLockPath = path.join(rootPath, 'yarn.lock');
  const packageLockJsonPath = path.join(rootPath, 'package-lock.json');
  const copiedYarnLockPath = path.join(buildCachePath, '.yarn.lock');
  const copiedPackageLockJsonPath = path.join(buildCachePath, '.package-lock.json');

  const shouldRestore = shouldRestoreNpmPackages(packageLockJsonPath, yarnLockPath, copiedPackageLockJsonPath);
  if (shouldRestore === false) {
    compileIfNeededAndRun(argv, rootPath, buildsystemPath, buildCache, buildCachePath, buildCacheManifestPath);
  } else {
    restoreNpmPackages(
      rootPath,
      shouldRestore,
      buildCachePath,
      packageLockJsonPath,
      yarnLockPath,
      copiedPackageLockJsonPath,
      copiedYarnLockPath,
    );
  }
}

/**
 * @param {string} yarnLockPath
 * @returns string
 */
function getYarnChecksumFilePath(yarnLockPath: string) {
  const yarnLockChecksumPath = path.join(path.dirname(yarnLockPath), 'tools', '.yarn.checksum');
  return yarnLockChecksumPath;
}

/**
 * @param {string} yarnLockPath
 */
function getYarnLockHash(yarnLockPath: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(yarnLockPath)).digest('hex');
}

/**
 * @param {string} yarnLockPath
 * @returns boolean
 */
function getShouldUpdateLockFile(yarnLockPath: string) {
  const yarnLockChecksumPath = getYarnChecksumFilePath(yarnLockPath);
  const lockFileHash = getYarnLockHash(yarnLockPath);
  let shouldUpdateLockFile = true;

  if (!fs.existsSync(yarnLockChecksumPath)) {
    fs.writeFileSync(yarnLockChecksumPath, lockFileHash);
  } else {
    const currentCachedHash = fs.readFileSync(yarnLockChecksumPath).toString();
    shouldUpdateLockFile = lockFileHash !== currentCachedHash;
  }

  return shouldUpdateLockFile;
}

/**
 * @param {string} rootPath
 * @param {'yarn' | 'npm'} restorePackagesWith
 * @param {string} buildCachePath
 * @param {string} packageLockJsonPath
 * @param {string} yarnLockPath
 * @param {string} copiedPackageLockJsonPath
 * @param {string} copiedYarnLockPath
 */
function restoreNpmPackages(
  rootPath: string,
  restorePackagesWith: 'yarn' | 'npm',
  buildCachePath: string,
  packageLockJsonPath: string,
  yarnLockPath: string,
  copiedPackageLockJsonPath: string,
  copiedYarnLockPath: string,
) {
  const restartGarn = () => {
    const garnPath = path.join(rootPath, 'node_modules', '.bin', 'garn' + execExt);
    const garn = childProcess.spawn(garnPath, process.argv.slice(2), {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
    });
    garn.on('exit', (exitCode: number) => process.exit(exitCode));
  };

  if (!fs.existsSync(buildCachePath)) {
    fs.mkdirSync(buildCachePath, { recursive: true });
  }

  if (restorePackagesWith === 'yarn') {
    let yarnPath = path.join(rootPath, 'yarn' + execExt);
    if (!fs.existsSync(yarnPath)) {
      yarnPath = 'yarn' + execExt;
    }

    const yarn = childProcess.spawn(yarnPath, [], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
    });
    yarn.on('exit', (exitCode: number) => {
      if (exitCode < 1) {
        cpSync(yarnLockPath, copiedYarnLockPath);

        const yarnLockChecksumPath = getYarnChecksumFilePath(yarnLockPath);
        const lockFileHash = getYarnLockHash(yarnLockPath);
        fs.writeFileSync(yarnLockChecksumPath, lockFileHash);

        restartGarn();
      } else {
        process.exit(exitCode);
      }
    });
  } else if (restorePackagesWith === 'npm') {
    let npmPath = path.join(rootPath, 'npm' + execExt);
    if (!fs.existsSync(npmPath)) {
      npmPath = 'npm' + execExt;
    }
    const npm = childProcess.spawn(npmPath, ['install'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
    });
    npm.on('exit', (exitCode: number) => {
      if (exitCode < 1) {
        cpSync(packageLockJsonPath, copiedPackageLockJsonPath);
        restartGarn();
      } else {
        process.exit(exitCode);
      }
    });
  }
}

/**
 * Copy file at sourcePath to destinationPath and preserve mtime.
 * @param {string} sourcePath
 * @param {string} destinationPath
 */
function cpSync(sourcePath: string, destinationPath: string) {
  const { atime, mtime } = fs.statSync(sourcePath);
  fs.copyFileSync(sourcePath, destinationPath);
  fs.utimesSync(destinationPath, atime, mtime);
}

/**
 * @param {string} packageLockJsonPath
 * @param {string} yarnLockPath
 * @param {string} copiedPackageLockJsonPath
 */
function shouldRestoreNpmPackages(
  packageLockJsonPath: string,
  yarnLockPath: string,
  copiedPackageLockJsonPath: string,
) {
  if (fs.existsSync(yarnLockPath)) {
    const hasNodeModulesFolder = fs.existsSync(path.join(yarnLockPath, '..', 'node_modules'));
    let shouldUpdateLockFile = getShouldUpdateLockFile(yarnLockPath);

    if (!hasNodeModulesFolder || shouldUpdateLockFile) {
      return 'yarn';
    } else {
      return false;
    }
  } else if (fs.existsSync(packageLockJsonPath)) {
    if (!fs.existsSync(copiedPackageLockJsonPath)) {
      return 'npm';
    } else {
      const packageLockJsonStats = fs.statSync(packageLockJsonPath);
      const copiedPackageLockJsonStats = fs.statSync(copiedPackageLockJsonPath);

      if (packageLockJsonStats.mtime.getTime() !== copiedPackageLockJsonStats.mtime.getTime()) {
        return 'npm';
      } else {
        return false;
      }
    }
  }
  return false;
}

/**
 * @param {minimist.ParsedArgs} argv
 * @param {string} rootPath
 * @param {string} buildsystemPath
 * @param {string} buildCache
 * @param {string} buildCachePath
 * @param {string} buildCacheManifestPath
 */
function compileIfNeededAndRun(
  argv: minimist.ParsedArgs,
  rootPath: string,
  buildsystemPath: string,
  buildCache: string,
  buildCachePath: string,
  buildCacheManifestPath: string,
) {
  const needsCompile = anyFileInManifestHasChanged(buildCacheManifestPath, buildsystemPath);
  let writeMetaData = false;

  const skipCompile = 'asap' in argv && fs.existsSync(buildCacheManifestPath);

  if ((!skipCompile && needsCompile) || 'compile-buildsystem' in argv) {
    writeMetaData = true;
    console.log('Compiling buildsystem...');
    compile(argv, rootPath, buildsystemPath, buildCache, buildCachePath, buildCacheManifestPath);

    // Temp code to copy package.json into .buildcache/
    const allPackagesPath = path.join(rootPath, 'packages');
    let packagesPath = path.join(buildCachePath, 'packages');
    if (!fs.existsSync(packagesPath)) {
      packagesPath = path.join(packagesPath, '..');
    }
    const packages = fs.readdirSync(packagesPath, {
      withFileTypes: true,
    });
    for (const info of packages) {
      const potentialPackageJson = path.join(allPackagesPath, info.name, 'package.json');
      if (info.isDirectory() && fs.existsSync(potentialPackageJson)) {
        fs.copyFileSync(potentialPackageJson, path.join(packagesPath, info.name, 'package.json'));
      }
    }

    if (!fs.existsSync(path.join(buildCachePath, 'index.js'))) {
      const files = fs.readdirSync(buildCachePath).filter(f => f !== 'node_modules');
      const parts = buildsystemPath
        .replace(/\\/g, '/')
        .split('/')
        .filter(f => !!f);
      for (let i = 0; i < files.length; i++) {
        const index = parts.indexOf(files[i]);
        if (index !== -1) {
          const relativePath = parts.slice(index).join('/');
          const builtPath = path.join(buildCachePath, relativePath, 'index.js');
          if (fs.existsSync(builtPath)) {
            fs.writeFileSync(path.join(buildCachePath, 'index.js'), "require('./" + relativePath + "/index.js');");
          }
        }
      }
    }
  }

  require(path.join(buildCachePath, 'index.js'));
  const garnJs = path.join(__dirname, '..', 'dist', 'index.js');
  const garn = require(garnJs);
  let promise = Promise.resolve();
  if (writeMetaData) {
    promise = garn.writeMetaData(buildCachePath);
  } else {
    promise = garn.writeMetaDataIfNotExists(buildCachePath);
  }
  promise
    .then(() => {
      return garn.run().catch((e: Error) => {
        console.error(e);
        process.exit(1);
      });
    })
    .catch(e => {
      console.error('error writing garn metadata', e);
    });
}

/**
 * @param {minimist.ParsedArgs} argv
 * @param {string} rootPath
 * @param {string} buildsystemPath
 * @param {string} buildCache
 * @param {string} buildCachePath
 * @param {string} buildCacheManifestPath
 */
function compile(
  argv: minimist.ParsedArgs,
  rootPath: string,
  buildsystemPath: string,
  buildCache: string,
  buildCachePath: string,
  buildCacheManifestPath: string,
) {
  const ts = require('typescript');
  const rimraf = require('rimraf');
  const tsConfigPath = path.join(buildsystemPath, 'tsconfig.json');
  const tsConfig = require(tsConfigPath);
  const parsed = ts.parseJsonConfigFileContent(tsConfig, ts.sys, buildsystemPath);
  parsed.options.outDir = backSlashToForwardSlash(buildCachePath);
  parsed.options.noEmit = false;
  parsed.options.target = ts.ScriptTarget.ES2015;
  parsed.options.module = ts.ModuleKind.CommonJS;
  parsed.options.jsx = ts.JsxEmit.React;
  parsed.options.incremental = true;
  parsed.options.rootDir = backSlashToForwardSlash(rootPath);
  parsed.options.tsBuildInfoFile = backSlashToForwardSlash(path.join(buildCachePath, '.tsbuildinfo'));
  parsed.options.configFilePath = backSlashToForwardSlash(tsConfigPath);

  if ('compile-buildsystem' in argv) {
    rimraf.sync(parsed.options.outDir);
  }

  const program = ts.createIncrementalProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  });
  let emitResult = program.emit(undefined, undefined, undefined, undefined, {
    before: [
      nodePathsTransformer(ts, program.getProgram()),
      createPathRewriteTransformer(program.getProgram(), Object.keys(parsed.options.paths || {})),
    ],
  });

  let allDiagnostics: typescript.Diagnostic[] = ts
    .getPreEmitDiagnostics(program.getProgram())
    .concat(emitResult.diagnostics);
  printDiagnostics(allDiagnostics, buildsystemPath);

  const manifest = buildCompilationManifest(buildCachePath, buildsystemPath, buildCache);
  fs.writeFileSync(buildCacheManifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * @param {typescript.Diagnostic[]} allDiagnostics
 * @param {string} buildsystemPath
 */
function printDiagnostics(allDiagnostics: typescript.Diagnostic[], buildsystemPath: string) {
  const ts = require('typescript');
  const chalk = require('chalk');
  const projectPath = path.join(buildsystemPath, '..');

  if (allDiagnostics.length) {
    console.log('');
    console.log(chalk.red('TypeScript error(s) found in buildsystem:'));
    console.log('');
  }

  allDiagnostics.forEach(diagnostic => {
    if (diagnostic.file) {
      const { line, character } = diagnostic.start
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        : { line: 0, character: 0 };
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      console.log(
        chalk.green(
          path.relative(projectPath, diagnostic.file.fileName) + '(' + line + 1 + ',' + character + 1 + '):',
        ) +
          ' ' +
          message,
      );
      console.log();
    } else {
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  });
}

type ManifestFiles = {
  original: {
    path: string;
    mtime: number;
  };
  compiled: {
    path: string;
    mtime: number;
  };
};
/**
 * @param {string} dirInBuildCache
 * @param {string} buildsystemPath
 * @param {string} buildCache
 */
function buildCompilationManifest(dirInBuildCache: string, buildsystemPath: string, buildCache: string) {
  const manifestFiles: ManifestFiles[] = [];
  let files: string[] = [];
  try {
    files = fs.readdirSync(dirInBuildCache);
  } catch (e) {}
  for (const file of files) {
    const fullPath = path.join(dirInBuildCache, file);
    if (!fullPath.endsWith('.map') && !file.startsWith('.')) {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const compilationManifest = buildCompilationManifest(fullPath, buildsystemPath, buildCache);
        for (const entry of compilationManifest.files) {
          manifestFiles.push(entry);
        }
      } else {
        const relative = path.relative(buildsystemPath, fullPath).replace(/\\/g, '/');
        const original = relative
          .replace(buildCache + '/', '')
          .replace(/\.js$/, '.ts')
          .replace(/\.jsx$/, '.tsx');
        let rootPath = path.normalize(path.join(buildsystemPath, '..')).replace(/\\/g, '/');
        let originalFullPath = path.join(rootPath, original);
        let tries = 0;
        while (!fs.existsSync(originalFullPath) && tries < 10) {
          tries++;

          const tsxOriginalFullPath = originalFullPath.replace(/\.ts$/, '.tsx');
          if (fs.existsSync(tsxOriginalFullPath)) {
            originalFullPath = tsxOriginalFullPath;
          } else {
            rootPath = path.normalize(path.join(rootPath, '..'));
            originalFullPath = path.join(rootPath, original);
          }
        }

        // We only care if we can find the original path.
        // Not all files in .buildcache/ are guaranteed to
        // come from a TypeScript compilation, so we skip
        // those.
        if (fs.existsSync(originalFullPath)) {
          manifestFiles.push({
            original: {
              path: originalFullPath,
              mtime: fs.statSync(originalFullPath).mtime.getTime(),
            },
            compiled: {
              path: fullPath,
              mtime: stat.mtime.getTime(),
            },
          });
        }
      }
    }
  }

  return {
    files: manifestFiles,
    buildsystemPath,
  };
}

/**
 * @param {string} buildCacheManifestPath
 * @param {string} buildsystemPath
 */
function anyFileInManifestHasChanged(buildCacheManifestPath: string, buildsystemPath: string) {
  if (!fs.existsSync(buildCacheManifestPath)) {
    return true;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(buildCacheManifestPath).toString());
  } catch (e) {
    return true;
  }
  if (path.resolve(manifest.buildsystemPath) !== path.resolve(buildsystemPath)) {
    // Avoid trailing slashes
    return true;
  }
  for (const entry of manifest.files) {
    try {
      const stats = fs.statSync(entry.original.path);
      if (stats.mtime.getTime() !== entry.original.mtime) {
        return true;
      }
    } catch (e) {
      return true;
    }
  }
  return false;
}

/**
 *
 * @param {typescript.Program} program
 * @param {string[]} paths
 * @returns
 */
function createPathRewriteTransformer(program: typescript.Program, paths: string[]) {
  const ts: typeof typescript = require('typescript');

  const rewrittenPaths = paths.map(path => new RegExp('^' + escapeRegExp(path).replace('\\*', '.')));
  /**
   *
   * @param {string} modulePath
   * @returns boolean
   */
  function _isRewrittenPath(modulePath: string) {
    for (const rewrittenPath of rewrittenPaths) {
      if (rewrittenPath.test(modulePath)) {
        return true;
      }
    }
    return false;
  }

  // Since files are taken from their source and placed inside the current package
  // it can mess with the Node module resolver. If we compile a .ts file that has
  // its own node_modules we want to ensure that we still require from that node_modules
  // and not a node_modules in the build destination.
  function _getLocalNodeModulesPath(importName: string, currentFile: string) {
    if (importName.startsWith('.')) {
      return false;
    }

    const parts = importName.split('/');
    let mainName = parts[0];
    if (mainName.startsWith('@')) {
      mainName += '/' + parts[1];
    }

    let currentFilePackageFolder = path.dirname(currentFile);

    let tries = 0;
    while (tries <= 10) {
      if (!fs.existsSync(path.join(currentFilePackageFolder, 'package.json'))) {
        currentFilePackageFolder = path.join(currentFilePackageFolder, '..');
      } else {
        break;
      }
      tries++;
    }
    if (tries === 10) {
      return false;
    }

    const localNodeModulesPath = path.join(currentFilePackageFolder, 'node_modules', mainName);
    if (fs.existsSync(localNodeModulesPath)) {
      return path.join(currentFilePackageFolder, 'node_modules');
    }

    return undefined;
  }

  return (context: typescript.TransformationContext) => (sourceFile: typescript.SourceFile) => {
    const typeChecker = program.getTypeChecker();

    /**
     *
     * @param {typescript.Node} node
     * @returns
     * Handles `import('...')` and `require('...')` statements.
     */
    const _visitNode = (node: typescript.Node) => {
      if (
        ts.isCallExpression(node) &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword || // import
          (ts.isIdentifier(node.expression) && ts.identifierToKeywordKind(node.expression))) // require
      ) {
        const importPath = node.arguments[0];
        const importSymbol = typeChecker.getSymbolAtLocation(importPath);

        if (
          importSymbol?.valueDeclaration &&
          ts.isSourceFile(importSymbol.valueDeclaration) &&
          !importSymbol.valueDeclaration.fileName.endsWith('.d.ts')
        ) {
          const fileName = importSymbol.valueDeclaration.fileName;
          if (_isRewrittenPath(importPath.text)) {
            let relativeDirPath = path
              .relative(path.dirname(sourceFile.fileName), path.dirname(fileName))
              .replace(/\\/g, '/');

            if (relativeDirPath.indexOf('.') !== 0) {
              relativeDirPath = './' + relativeDirPath;
            }

            let relativeImport = relativeDirPath + '/' + path.basename(importSymbol.valueDeclaration.fileName);

            relativeImport = relativeImport.replace(/\.ts$/, '.js');
            relativeImport = relativeImport.replace(/\.tsx$/, '.js');

            return context.factory.createCallExpression(context.factory.createIdentifier('import'), undefined, [
              context.factory.createStringLiteral(backSlashToForwardSlash(relativeImport)),
            ]);
          }
        }

        const localNodeModules = _getLocalNodeModulesPath(importPath.text, sourceFile.fileName);
        if (localNodeModules) {
          return context.factory.createCallExpression(context.factory.createIdentifier('require'), undefined, [
            context.factory.createStringLiteral(backSlashToForwardSlash(localNodeModules) + '/' + importPath.text),
          ]);
        }
      }

      /**
       * Handles `require.resolve('...')` statements
       */
      if (
        ts.isCallExpression(node) &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === 'resolve' &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'require'
      ) {
        const localNodeModules = _getLocalNodeModulesPath(node.arguments[0].text, sourceFile.fileName);
        if (localNodeModules) {
          return context.factory.updateCallExpression(node, node.expression, node.typeArguments, [
            context.factory.createStringLiteral(
              backSlashToForwardSlash(localNodeModules) + '/' + node.arguments[0].text,
            ),
          ]);
        }
      }

      /**
       * handles `import {...} from '...'` and `import * as ... from '...'`
       */
      if (
        ts.isImportDeclaration(node) &&
        (!node.importClause || !node.importClause.isTypeOnly) &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const importSymbol = typeChecker.getSymbolAtLocation(node.moduleSpecifier);

        if (
          importSymbol?.valueDeclaration &&
          ts.isSourceFile(importSymbol.valueDeclaration) &&
          !importSymbol.valueDeclaration.fileName.endsWith('.d.ts')
        ) {
          const fileName = importSymbol.valueDeclaration.fileName;
          if (_isRewrittenPath(node.moduleSpecifier.text)) {
            let relativeDirPath = path
              .relative(path.dirname(sourceFile.fileName), path.dirname(fileName))
              .replace(/\\/g, '/');

            if (relativeDirPath.indexOf('.') !== 0) {
              relativeDirPath = './' + relativeDirPath;
            }

            let relativeImport = relativeDirPath + '/' + path.basename(importSymbol.valueDeclaration.fileName);

            relativeImport = relativeImport.replace(/\.ts$/, '.js');
            relativeImport = relativeImport.replace(/\.tsx$/, '.js');

            return context.factory.updateImportDeclaration(
              node,
              node.modifiers,
              node.importClause,
              context.factory.createStringLiteral(relativeImport),
              undefined,
            );
          }
        }

        const localNodeModules = _getLocalNodeModulesPath(node.moduleSpecifier.text, sourceFile.fileName);
        if (localNodeModules) {
          return context.factory.updateImportDeclaration(
            node,
            node.modifiers,
            node.importClause,
            context.factory.createStringLiteral(
              backSlashToForwardSlash(localNodeModules) + '/' + node.moduleSpecifier.text,
            ),
            undefined,
          );
        }
      } else if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        _isRewrittenPath(node.moduleSpecifier.text)
      ) {
        const importSymbol = typeChecker.getSymbolAtLocation(node.moduleSpecifier);

        if (
          importSymbol?.valueDeclaration &&
          ts.isSourceFile(importSymbol.valueDeclaration) &&
          !importSymbol.valueDeclaration.fileName.endsWith('.d.ts')
        ) {
          const fileName = importSymbol.valueDeclaration.fileName;

          let relativeDirPath = path
            .relative(path.dirname(sourceFile.fileName), path.dirname(fileName))
            .replace(/\\/g, '/');

          if (relativeDirPath.indexOf('.') !== 0) {
            relativeDirPath = './' + relativeDirPath;
          }

          let relativeImport = relativeDirPath + '/' + path.basename(importSymbol.valueDeclaration.fileName);

          relativeImport = relativeImport.replace(/\.ts$/, '.js');
          relativeImport = relativeImport.replace(/\.tsx$/, '.js');

          return context.factory.updateExportDeclaration(
            node,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            context.factory.createStringLiteral(relativeImport),
            undefined,
          );
        }
      }

      return node;
    };

    function _visitNodeAndChildren(node: typescript.Node): typescript.Node {
      const visitedNode = _visitNode(node);
      const visitedChildNode = ts.visitEachChild<typescript.Node>(
        visitedNode,
        (childNode: typescript.Node) => _visitNodeAndChildren(childNode),
        context,
      );
      return visitedChildNode;
    }

    const transformedSourceFile = ts.visitEachChild(
      _visitNode(sourceFile),
      (childNode: typescript.Node) => _visitNodeAndChildren(childNode),
      context,
    );
    return transformedSourceFile;
  };
}

function backSlashToForwardSlash(filePath: string) {
  return filePath.replace(/\\/g, '/');
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nodePathsTransformer(ts: typeof typescript, program: typescript.Program) {
  return (context: typescript.TransformationContext) => (file: typescript.SourceFile) =>
    visitSourceFile(ts, file, program, context);
}

function visitSourceFile(
  ts: typeof typescript,
  sourceFile: typescript.SourceFile,
  program: typescript.Program,
  context: typescript.TransformationContext,
) {
  const transformedSourceFile = ts.visitEachChild(
    visitNode(ts, sourceFile, context),
    (childNode: typescript.Node) => visitNodeAndChildren(ts, childNode, sourceFile, program, context),
    context,
  );
  return transformedSourceFile;
}

function visitNodeAndChildren(
  ts: typeof typescript,
  node: typescript.Node,
  sourceFile: typescript.SourceFile,
  program: typescript.Program,
  context: typescript.TransformationContext,
): typescript.Node {
  const visitedNode = visitNode(ts, node, context);
  if (visitedNode === node) {
    const visitedChildNode: typescript.Node = ts.visitEachChild(
      visitedNode,
      (childNode: typescript.Node) => visitNodeAndChildren(ts, childNode, sourceFile, program, context),
      context,
    );
    return visitedChildNode;
  }
  return visitedNode;
}

function visitNode(ts: typeof typescript, node: typescript.Node, context: typescript.TransformationContext) {
  if (ts.isIdentifier(node)) {
    const factory = context.factory;
    if (node.escapedText === '___dirname') {
      const parts = node.getSourceFile().fileName.split('/');
      parts.pop();
      return factory.createStringLiteral(parts.join('/'));
    } else if (node.escapedText === '___filename') {
      return factory.createStringLiteral(node.getSourceFile().fileName);
    }
  }
  return node;
}
