"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.highest = exports.formatPrerelease = exports.formatGitTag = exports.parse = exports.isValid = exports.fromTag = exports.isVersionTag = exports.latestVersion = exports.currentVersion = exports.formatVersion = void 0;
const cliArgs = require("./cli-args");
const git = require("./git");
const workspace = require("./workspace");
const log = require("./logging");
/**
 * Matches:
 * package@1.2.3
 * package_name@1.2.999-rc.1
 * @avensia-package@2.2.3
 * With support for named groups
 */
const gitTagRegex = /^(?<name>@?[a-zA-Z0-9_-]+)@(?<version>(?<versionCore>[0-9]+\.[0-9]+\.[0-9]+)(\-(?<preRelease>[a-zA-Z0-9\.]+))?)$/;
/**
 * Returns a string with format X.Y.Z(W) (semver 2.0 https://semver.org/spec/v2.0.0.html)
 * If the current commit has a pre-release, W will be the '-tagname.pre-release-number'.
 */
function formatVersion(version) {
    let versionString = version.version;
    if (version.prerelease) {
        versionString += `-${version.prerelease.tag}.${version.prerelease.number}`;
    }
    return versionString;
}
exports.formatVersion = formatVersion;
function currentVersion() {
    var _a, _b, _c, _d, _e;
    return __awaiter(this, void 0, void 0, function* () {
        const cliVersionString = yield cliArgs.flags.version.get();
        if (cliVersionString !== undefined) {
            const cliVersion = yield fromTag(cliVersionString);
            const currentPackageName = (_a = workspace.current()) === null || _a === void 0 ? void 0 : _a.name;
            if (cliVersion.packageName && cliVersion.packageName !== currentPackageName) {
                throw new Error(`The cli flag --version was set to '${cliVersionString}' but that does not match the current package which is '${currentPackageName ? currentPackageName : '(none)'}'`);
            }
            // If the version is passed as `--version v1.0.0` it means that it applies to all workspace packages and we
            // inject the current package name. This allows you to do:
            // $ garn workspace publish --version=v1.0.0
            // to publish all packages as 1.0.0
            if (!cliVersion.packageName && currentPackageName) {
                cliVersion.packageName = currentPackageName;
            }
            return cliVersion;
        }
        if ((yield cliArgs.flags.mode.get()) !== 'production') {
            return yield unknownVersion();
        }
        const currentSha1 = yield git.revParse('HEAD');
        const currentBranch = yield git.branchName('HEAD');
        const latest = yield latestVersion();
        if (latest.sha1 === currentSha1) {
            return latest;
        }
        const commitsSinceLatest = yield git.commitCountBetween(latest.sha1, currentSha1);
        return {
            version: latest.version,
            packageName: latest.packageName,
            sha1: currentSha1,
            prerelease: {
                tag: (_c = (_b = latest.prerelease) === null || _b === void 0 ? void 0 : _b.tag) !== null && _c !== void 0 ? _c : currentBranch,
                number: Number(commitsSinceLatest) + ((_e = (_d = latest.prerelease) === null || _d === void 0 ? void 0 : _d.number) !== null && _e !== void 0 ? _e : 0),
            },
        };
    });
}
exports.currentVersion = currentVersion;
function latestVersion(skipPrereleases = false, packageName, outSkippedPrereleases) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let currentRef = 'HEAD';
        packageName = packageName !== null && packageName !== void 0 ? packageName : (_a = workspace.current()) === null || _a === void 0 ? void 0 : _a.name;
        while (true) {
            // Note that we match both vX.Y.Z tags and package-name@X.Y.Z tags here. We simply want to find
            // the latest one of any of those two patterns.
            // This is useful when you typically release all packages at the same time with a vX.Y.Z tag
            // but sometimes tag a single package because you need to create a hotfix for that specific package.
            const matchArgs = [];
            matchArgs.push('--match', 'v[0-9]*');
            if (packageName) {
                matchArgs.push('--match', packageName + '@*');
            }
            let latestTag = '';
            try {
                latestTag = yield git.describe(['--tags', ...matchArgs, '--abbrev=0', currentRef]);
            }
            catch (e) {
                log.verbose(e);
                return yield unknownVersion(packageName);
            }
            const version = yield fromTag(latestTag);
            if (version.prerelease && skipPrereleases) {
                if (outSkippedPrereleases) {
                    outSkippedPrereleases.push(version);
                }
                currentRef = version.sha1 + '~1';
            }
            else {
                version.packageName = packageName;
                return version;
            }
        }
    });
}
exports.latestVersion = latestVersion;
function isVersionTag(s) {
    if (!s) {
        return false;
    }
    return gitTagRegex.test(s) || /^v[0-9]+\.[0-9]+\.[0-9]+(\-[a-zA-Z0-9\.]+)?$/.test(s);
}
exports.isVersionTag = isVersionTag;
function fromTag(gitTag, includeSha = true) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        if (!isVersionTag(gitTag)) {
            throw new Error(`The tag '${gitTag}' is not a valid version tag`);
        }
        const packageName = (_b = (_a = gitTagRegex.exec(gitTag)) === null || _a === void 0 ? void 0 : _a.groups) === null || _b === void 0 ? void 0 : _b.name;
        const version = (_d = (_c = gitTagRegex.exec(gitTag)) === null || _c === void 0 ? void 0 : _c.groups) === null || _d === void 0 ? void 0 : _d.versionCore;
        const prereleaseParts = gitTag.split(/-([a-zA-Z0-9\.]+)\.([0-9]+)$/);
        const prerelease = prereleaseParts.length === 4 ? { tag: prereleaseParts[1], number: Number(prereleaseParts[2]) } : undefined;
        let sha1 = '';
        if (includeSha) {
            try {
                sha1 = yield git.revParse(gitTag);
            }
            catch (e) {
                log.verbose(`Error resolving sh1 for tag '${gitTag}', falling back to sha1 for HEAD...`);
                sha1 = yield git.revParse('HEAD');
            }
        }
        return {
            gitTag,
            sha1,
            version,
            packageName,
            prerelease,
        };
    });
}
exports.fromTag = fromTag;
/** Tests that a string matches the pattern `X.Y.Z`, for example `1.2.3` or `10.31.997` */
function isValid(versionNumbers) {
    return /^[0-9]+\.[0-9]+\.[0-9]+$/.test(versionNumbers);
}
exports.isValid = isValid;
function parse(version) {
    const parts = version.version.split('.').map(Number);
    if (version.prerelease) {
        parts.push(version.prerelease.number);
    }
    return parts;
}
exports.parse = parse;
function formatGitTag(packageName, version, prereleaseNumber, prereleaseTag) {
    const prereleaseSuffix = prereleaseNumber ? formatPrerelease(prereleaseTag !== null && prereleaseTag !== void 0 ? prereleaseTag : 'unknown', prereleaseNumber) : '';
    if (packageName) {
        return `${packageName}@${version}${prereleaseSuffix}`;
    }
    else {
        return `v${version}${prereleaseSuffix}`;
    }
}
exports.formatGitTag = formatGitTag;
function formatPrerelease(prereleaseTag, prereleaseNumber) {
    // maintain a consistent pre-release tag and package version for Semantic Versioning v2.0.0
    return `-${prereleaseTag !== null && prereleaseTag !== void 0 ? prereleaseTag : 'unknown'}.${prereleaseNumber}`;
}
exports.formatPrerelease = formatPrerelease;
function highest(va, vb) {
    const vaParts = parse(va);
    const vbParts = parse(vb);
    if (vaParts[0] > vbParts[0]) {
        return va;
    }
    if (vaParts[0] < vbParts[0]) {
        return vb;
    }
    if (vaParts[1] > vbParts[1]) {
        return va;
    }
    if (vaParts[1] < vbParts[1]) {
        return vb;
    }
    if (vaParts[2] > vbParts[2]) {
        return va;
    }
    if (vaParts[2] < vbParts[2]) {
        return vb;
    }
    if (typeof vaParts[3] === 'number' && typeof vbParts[3] === 'number') {
        if (vaParts[3] > vbParts[3]) {
            return va;
        }
        if (vaParts[3] < vbParts[3]) {
            return vb;
        }
        if (vaParts[3] === vbParts[3]) {
            return 'same';
        }
    }
    if (typeof vaParts[3] === 'number' && typeof vbParts[3] === 'undefined') {
        // If va is 1.2.3 and vb is 1.2.3-rc0003 we consider va to be higher
        return vb;
    }
    if (typeof vaParts[3] === 'undefined' && typeof vbParts[3] === 'number') {
        return va;
    }
    return 'same';
}
exports.highest = highest;
function unknownVersion(packageName) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        return {
            version: '0.0.0',
            sha1: yield git.revParse('HEAD'),
            packageName: packageName !== null && packageName !== void 0 ? packageName : (_a = workspace.current()) === null || _a === void 0 ? void 0 : _a.name,
        };
    });
}
//# sourceMappingURL=version.js.map