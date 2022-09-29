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
exports.CreateRelease = void 0;
const rest_1 = require("@octokit/rest");
const _1 = require(".");
const os = require("os");
function CreateRelease(tagName, previousTag, srcPath = '', config, releaseName) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        const userAgent = `${(_a = config.app) !== null && _a !== void 0 ? _a : 'garn/oss'} ${config.org} `.trim();
        const generateAutoReleaseNotes = (_b = config.generateAutoReleaseNotes) !== null && _b !== void 0 ? _b : false;
        const octokit = new rest_1.Octokit({
            auth: config.auth,
            userAgent: userAgent,
            timezone: (_c = config.timezone) !== null && _c !== void 0 ? _c : 'Europe/Stockholm',
            baseUrl: (_d = config.baseUrl) !== null && _d !== void 0 ? _d : 'https://api.github.com',
            generateAutoReleaseNotes: generateAutoReleaseNotes,
            log: {
                debug: () => { var _a; return (((_a = config.logLevel) !== null && _a !== void 0 ? _a : '') == 'debug' ? console.debug : {}); },
                info: () => { var _a; return (((_a = config.logLevel) !== null && _a !== void 0 ? _a : '') == 'info' ? console.info : {}); },
                warn: console.warn,
                error: console.error,
            },
        });
        const gitUrl = `https://github.com/${config.org}/${config.repo}/`;
        const releaseNotes = yield generateReleaseNotes(tagName, previousTag, srcPath, gitUrl, 'markdown');
        yield octokit.rest.repos.createRelease({
            tag_name: tagName,
            name: releaseName !== null && releaseName !== void 0 ? releaseName : tagName,
            body: releaseNotes,
            owner: config.org,
            repo: config.repo,
            generate_release_notes: generateAutoReleaseNotes,
        });
        function generateReleaseNotes(toTag, fromTag, workspaceSrcPath, repoUrl, format = 'markdown') {
            return __awaiter(this, void 0, void 0, function* () {
                const packageResult = yield _1.git.logBetween({
                    to: toTag,
                    from: fromTag,
                    path: workspaceSrcPath,
                });
                let formattedOutput = _1.changelog.formatTitle(toTag, repoUrl, format);
                packageResult.forEach(commit => {
                    formattedOutput.push(..._1.changelog.formatCommit(commit, repoUrl, format));
                });
                return formattedOutput.join(os.EOL);
            });
        }
    });
}
exports.CreateRelease = CreateRelease;
//# sourceMappingURL=github.js.map