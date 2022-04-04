#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');

const buildsystemPathArgName = 'buildsystem-path';
if (!process.argv.find(v => v === '--' + buildsystemPathArgName)) {
  const assumedBuildsystemPath = path.join(process.cwd(), 'buildsystem');
  if (!fs.existsSync(assumedBuildsystemPath)) {
    console.log('Error! No buildsystem folder exists at:', assumedBuildsystemPath);
    console.log('You are most likely executing Garn from the incorrect folder. Your working directory should contain a folder called buildsystem that contains the Garn tasks.');
    process.exit(1);
  }
  process.argv.push('--' + buildsystemPathArgName, assumedBuildsystemPath);
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

const needsCompile = anyFileInManifestHasChanged();
let writeMetaData = false;

const skipCompile = 'asap' in argv && fs.existsSync(buildCacheManifestPath);

if ((!skipCompile && needsCompile) || 'compile-buildsystem' in argv) {
  writeMetaData = true;
  console.log('Compiling buildsystem...');
  compile();

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
    if (info.isDirectory && fs.existsSync(potentialPackageJson)) {
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
promise.then(() => {
  return garn.run().catch(e => {
    console.error(e);
    process.exit(1);
  });
});

function compile() {
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

  let allDiagnostics = ts.getPreEmitDiagnostics(program.getProgram()).concat(emitResult.diagnostics);
  printDiagnostics(allDiagnostics);

  const manifest = buildCompilationManifest(buildCachePath, buildsystemPath);
  fs.writeFileSync(buildCacheManifestPath, JSON.stringify(manifest, null, 2));
}

function printDiagnostics(allDiagnostics) {
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

function buildCompilationManifest(dirInBuildCache, buildsystemPath) {
  const manifestFiles = [];
  let files = [];
  try {
    files = fs.readdirSync(dirInBuildCache);
  } catch (e) {}
  for (const file of files) {
    const fullPath = path.join(dirInBuildCache, file);
    if (!fullPath.endsWith('.map') && !file.startsWith('.')) {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const compilationManifest = buildCompilationManifest(fullPath, buildsystemPath);
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

function anyFileInManifestHasChanged() {
  if (!fs.existsSync(buildCacheManifestPath)) {
    return true;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(buildCacheManifestPath).toString());
  } catch (e) {
    return true;
  }
  if (manifest.buildsystemPath !== buildsystemPath) {
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
 * @param {ts.Program} program 
 * @param {string[]} paths 
 * @returns 
 */
function createPathRewriteTransformer(program, paths) {
  const ts = require('typescript');

  const rewrittenPaths = paths.map(path => new RegExp('^' + escapeRegExp(path).replace('\\*', '.')));
  /**
   * 
   * @param {string} modulePath 
   * @returns boolean
   */
  function isRewrittenPath(modulePath) {
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
  function getLocalNodeModulesPath(importName, currentFile) {
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

  return context => sourceFile => {
    const typeChecker = program.getTypeChecker();

    /**
     * 
     * @param {ts.Node} node 
     * @returns 
     * Handles `import('...')` and `require('...')` statements.
     */
    const visitNode = node => {
      if (
        ts.isCallExpression(node) &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) && (
          node.expression.kind === ts.SyntaxKind.ImportKeyword || ( // import
            ts.isIdentifier(node.expression) &&
            node.expression.originalKeywordKind === ts.SyntaxKind.RequireKeyword // require
          )
        )
      ) {
        const importPath = node.arguments[0];
        const importSymbol = typeChecker.getSymbolAtLocation(importPath);

        if (
          importSymbol &&
          ts.isSourceFile(importSymbol.valueDeclaration) &&
          !importSymbol.valueDeclaration.fileName.endsWith('.d.ts')
        ) {
          const fileName = importSymbol.valueDeclaration.fileName;
          if (isRewrittenPath(importPath.text)) {
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

        const localNodeModules = getLocalNodeModulesPath(importPath.text, sourceFile.fileName);
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
        const localNodeModules = getLocalNodeModulesPath(node.arguments[0].text, sourceFile.fileName);
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
          importSymbol &&
          ts.isSourceFile(importSymbol.valueDeclaration) &&
          !importSymbol.valueDeclaration.fileName.endsWith('.d.ts')
        ) {
          const fileName = importSymbol.valueDeclaration.fileName;
          if (isRewrittenPath(node.moduleSpecifier.text)) {
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
              node.decorators,
              node.modifiers,
              node.importClause,
              context.factory.createStringLiteral(relativeImport),
            );
          }
        }

        const localNodeModules = getLocalNodeModulesPath(node.moduleSpecifier.text, sourceFile.fileName);
        if (localNodeModules) {
          return context.factory.updateImportDeclaration(
            node,
            node.decorators,
            node.modifiers,
            node.importClause,
            context.factory.createStringLiteral(
              backSlashToForwardSlash(localNodeModules) + '/' + node.moduleSpecifier.text,
            ),
          );
        }
      } else if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        isRewrittenPath(node.moduleSpecifier.text)
      ) {
        const importSymbol = typeChecker.getSymbolAtLocation(node.moduleSpecifier);
        
        if (
          importSymbol &&
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
            node.decorators,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            context.factory.createStringLiteral(relativeImport),
          );
        }
      }

      return node;
    };

    function visitNodeAndChildren(node) {
      const visitedNode = visitNode(node);
      const visitedChildNode = ts.visitEachChild(visitedNode, childNode => visitNodeAndChildren(childNode), context);
      return visitedChildNode;
    }

    const transformedSourceFile = ts.visitEachChild(
      visitNode(sourceFile),
      childNode => visitNodeAndChildren(childNode),
      context,
    );
    return transformedSourceFile;
  };
}

function backSlashToForwardSlash(filePath) {
  return filePath.replace(/\\/g, '/');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nodePathsTransformer(ts, program) {
  return context => file => visitSourceFile(ts, file, program, context);
}

function visitSourceFile(ts, sourceFile, program, context) {
  const transformedSourceFile = ts.visitEachChild(
    visitNode(ts, sourceFile),
    childNode => visitNodeAndChildren(ts, childNode, sourceFile, program, context),
    context,
  );
  return transformedSourceFile;
}

function visitNodeAndChildren(ts, node, sourceFile, program, context) {
  const visitedNode = visitNode(ts, node);
  if (visitedNode === node) {
    const visitedChildNode = ts.visitEachChild(
      visitedNode,
      childNode => visitNodeAndChildren(ts, childNode, sourceFile, program, context),
      context,
    );
    return visitedChildNode;
  }
  return visitedNode;
}

function visitNode(ts, node) {
  if (node.kind == ts.SyntaxKind.Identifier) {
    if (node.escapedText === '___dirname') {
      const parts = node.getSourceFile().fileName.split('/');
      parts.pop();
      return ts.createStringLiteral(parts.join('/'));
    } else if (node.escapedText === '___filename') {
      return ts.createStringLiteral(node.getSourceFile().fileName);
    }
  }
  return node;
}
