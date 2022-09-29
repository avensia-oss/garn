"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCommit = exports.formatTitle = void 0;
const formatters = {
    markdown: {
        heading(text, level, repoUrl) {
            return ['#'.repeat(level) + ` [${text}](${repoUrl}/releases/tag/${text})`];
        },
        commit(commit, repoUrl) {
            var _a, _b;
            const lines = [];
            if (commit.isMerge) {
                lines.push(`- [#${(_a = commit.merge) === null || _a === void 0 ? void 0 : _a.pullNumber} - ${commit.body}](${repoUrl}/pull/${(_b = commit.merge) === null || _b === void 0 ? void 0 : _b.pullNumber}) ${commit.references}`);
                lines.push(`   `);
            }
            else {
                lines.push(`- [${commit.subject}](${repoUrl}/commit/${commit.sha1}) ${commit.references}`);
                lines.push(`   `);
                if (commit.body && commit.body !== '') {
                    lines.push(`  ${commit.body}`);
                    lines.push(`   `);
                }
                lines.push(`  <sup>Date: ${commit.date}, author: [${commit.author}](${commit.email})</sup>  `);
                lines.push(`   `);
            }
            return lines;
        },
    },
};
function formatTitle(title, repoUrl, format) {
    const formatter = typeof format !== 'string' ? format : formatters[format];
    return formatter.heading(title, 1, repoUrl);
}
exports.formatTitle = formatTitle;
function formatCommit(commit, repoUrl, format) {
    const formatter = typeof format !== 'string' ? format : formatters[format];
    return formatter.commit(commit, repoUrl);
}
exports.formatCommit = formatCommit;
//# sourceMappingURL=change-log.js.map