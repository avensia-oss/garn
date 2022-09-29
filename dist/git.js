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
exports.logBetween = exports.pull = exports.fetch = exports.push = exports.branchName = exports.merge = exports.deleteTag = exports.tagExists = exports.tag = exports.tagList = exports.getDetailedTags = exports.getTags = exports.branch = exports.checkout = exports.status = exports.describe = exports.revParseAbbr = exports.commitCountBetween = exports.revParse = void 0;
const exec_1 = require("./exec");
const index_1 = require("./index");
const log = require("./logging");
const version_1 = require("./version");
function revParse(name, cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        return git(['rev-parse', name], cwd);
    });
}
exports.revParse = revParse;
function commitCountBetween(from, to, cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        return git(['rev-list', '--count', '^' + from, to], cwd);
    });
}
exports.commitCountBetween = commitCountBetween;
function revParseAbbr(name, cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        let ref = yield git(['rev-parse', '--abbrev-ref', name], cwd);
        if (ref === '') {
            ref = yield revParse(name, cwd);
        }
        return ref;
    });
}
exports.revParseAbbr = revParseAbbr;
function describe(args = [], cwd) {
    return git(['describe'].concat(args), cwd);
}
exports.describe = describe;
function status(args = [], cwd) {
    return git(['status'].concat(args), cwd);
}
exports.status = status;
function checkout(name, cwd) {
    return git(['checkout', name], cwd);
}
exports.checkout = checkout;
function branch(args = [], cwd) {
    return git(['branch'].concat(args), cwd);
}
exports.branch = branch;
function getTags(name = 'HEAD', cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        const tags = yield git(['tag', '--points-at', name], cwd);
        return tags.split('\n').map(s => s.trim());
    });
}
exports.getTags = getTags;
function getDetailedTags(cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        const deliminator = '!!!';
        const args = ['for-each-ref', '--sort=-creatordate', `--format=%(refname)${deliminator}%(creatordate)`, 'refs/tags'];
        const result = yield git(args, cwd);
        const tags = result.split('\n');
        const parsedTags = yield Promise.all(tags.map((tagRaw) => __awaiter(this, void 0, void 0, function* () {
            const [tagWithRef, date] = tagRaw.split(deliminator);
            const tag = tagWithRef.replace('refs/tags/', '');
            return {
                name: tag,
                createdAt: new Date(date),
                version: (0, version_1.isVersionTag)(tag) ? yield (0, version_1.fromTag)(tag, false) : null,
            };
        })));
        return parsedTags;
    });
}
exports.getDetailedTags = getDetailedTags;
function tagList(name, limit, excludeRC = true, cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        let args = ['tag', '-l', name + '@*', '--sort=-version:refname'];
        const tags = yield git(args, cwd);
        const splitTags = tags.split('\n').map(s => s.trim());
        let result = splitTags;
        if (excludeRC) {
            result = splitTags.filter(s => !s.match(/(-rc.)/));
        }
        return limit ? result.slice(0, limit) : result;
    });
}
exports.tagList = tagList;
function tag(tag, message, cwd) {
    return message ? git(['tag', '-a', tag, '--cleanup=whitespace', '-m', message], cwd) : git(['tag', tag], cwd);
}
exports.tag = tag;
function tagExists(tag, cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield revParse(tag, cwd);
            return true;
        }
        catch (e) {
            return false;
        }
    });
}
exports.tagExists = tagExists;
function deleteTag(tag, cwd) {
    return git(['tag', '-d', tag], cwd);
}
exports.deleteTag = deleteTag;
function merge(name, commitMessage, fastForward = false, cwd) {
    let args = ['merge'];
    if (!fastForward) {
        args.push('--no-ff');
    }
    args = args.concat([name, '-m', commitMessage]);
    return git(args, cwd);
}
exports.merge = merge;
function branchName(name, cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        const refName = yield revParseAbbr(name, cwd);
        if (refName === name) {
            const remoteBranches = (yield git(['branch', '-r', '--contains', name], cwd)).split('\n').map(s => s
                // Replaces `origin/HEAD -> origin/master` with `origin/master`
                .replace(/^.*? -> /, '')
                // Replaces `origin/master` with `master`
                .replace(/^.*?\//, '')
                .trim());
            if (remoteBranches.length) {
                if (remoteBranches.length > 1) {
                    log.log('Found several branches for current commit: ' + remoteBranches.join(', ') + ', selecting the first one');
                }
                return remoteBranches[0];
            }
            return 'unknown';
        }
        return refName;
    });
}
exports.branchName = branchName;
function push(names, cwd) {
    if (typeof names === 'string') {
        names = [names];
    }
    return gitWithNetwork(['push', 'origin'].concat(names), cwd);
}
exports.push = push;
function fetch(cwd) {
    return gitWithNetwork(['fetch', '--tags', '--quiet'], cwd);
}
exports.fetch = fetch;
function pull(withRebase = true, cwd) {
    const args = ['pull'];
    if (withRebase) {
        args.push('--rebase');
    }
    return gitWithNetwork(args, cwd);
}
exports.pull = pull;
function git(args, cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield (0, exec_1.spawn)('git', args, { stdio: 'pipe', cwd: cwd !== null && cwd !== void 0 ? cwd : index_1.projectPath });
        return result.stdout.trim();
    });
}
function gitSync(args, cwd) {
    const result = (0, exec_1.spawnSync)('git', args, { stdio: 'pipe', cwd: cwd !== null && cwd !== void 0 ? cwd : index_1.projectPath });
    return result.stdout.trim();
}
function gitWithNetwork(args, cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, exec_1.spawn)('git', args, { stdio: 'inherit', cwd });
    });
}
const separator = '?!!!!!?';
const newLineSeparator = '!?????!';
const logFormat = `%h${separator}%b${separator}%cs${separator}%an${separator}%ae${separator}%d${separator}%s${separator}%p${newLineSeparator}`;
const sha1Index = 0; //%h
const bodyIndex = 1; //%b body
const dateIndex = 2; //%cs short format (YYYY-MM-DD)
const authorNameIndex = 3; //%an';
const authorEmailIndex = 4; //%ae';
const referencesIndex = 5; //%d tags etc';
const subjectIndex = 6; //%s';
const sha1RangeIndex = 7; //%p abbreviated parent hashes
const commit_regex = '^((fixup!)|(feat|fix|refactor|style|chore|docs|test|revert))';
const typeRegex = new RegExp(commit_regex);
function logBetween(options = {
    to: 'HEAD',
    path: '',
    onlyMerges: false,
}, cwd) {
    return __awaiter(this, void 0, void 0, function* () {
        let args = ['log', '--topo-order', `--pretty=format:${logFormat}`];
        if (options.onlyMerges) {
            args.push('--merges');
        }
        if ((options === null || options === void 0 ? void 0 : options.to) && options.to !== '') {
            args.push(options.to + '...' + options.from);
        }
        if ((options === null || options === void 0 ? void 0 : options.since) && options.since !== '') {
            args.push(`--since=${options.since}`);
        }
        if ((options === null || options === void 0 ? void 0 : options.until) && options.until !== '') {
            args.push(`--until=${options.until}`);
        }
        if ((options === null || options === void 0 ? void 0 : options.path) && options.path != '') {
            args.push(options.path);
        }
        const rawCommitOutput = yield gitSync(args, cwd);
        const rawCommits = rawCommitOutput
            .replace(/\r?\n/g, '') // Removes new line
            .split(newLineSeparator)
            .map(s => s.trim());
        if (!rawCommits || rawCommits.length === 0) {
            return [];
        }
        let commits = [];
        rawCommits.forEach(commit => {
            if (commit && commit !== '') {
                commits.push(parseRawCommitMessage(commit));
            }
        });
        return commits;
    });
}
exports.logBetween = logBetween;
function parseRawCommitMessage(rawCommit) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const values = rawCommit.split(separator);
    const isMerge = (_c = (((_a = values[subjectIndex]) === null || _a === void 0 ? void 0 : _a.startsWith('Merge')) && ((_b = values[subjectIndex]) === null || _b === void 0 ? void 0 : _b.includes('#')))) !== null && _c !== void 0 ? _c : false;
    const commitType = !isMerge ? (_d = typeRegex.exec(values[subjectIndex])) !== null && _d !== void 0 ? _d : [''] : ['merge'];
    const commit = {
        sha1: values[sha1Index],
        body: (_e = values[bodyIndex]) !== null && _e !== void 0 ? _e : '',
        date: values[dateIndex],
        author: (_f = values[authorNameIndex]) !== null && _f !== void 0 ? _f : '',
        email: (_g = values[authorEmailIndex]) !== null && _g !== void 0 ? _g : '',
        references: (_h = values[referencesIndex]) !== null && _h !== void 0 ? _h : '',
        type: commitType[0],
        isMerge,
        subject: isMerge ? 'Merge' : (_j = values[subjectIndex]) !== null && _j !== void 0 ? _j : '',
    };
    if (isMerge) {
        var mergeMessage = values[subjectIndex].split(' ');
        var commitRange = values[sha1RangeIndex].slice(0, values[sha1RangeIndex].length - 1).split(' '); // remove quote
        commit.merge = {
            pullNumber: mergeMessage[3].slice(1),
            baseSha1: commitRange[0],
            toSha1: commitRange[1],
            commits: [],
        };
    }
    return commit;
}
//# sourceMappingURL=git.js.map