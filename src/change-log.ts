import { Commit } from './git';

type ChangeLogFormatter = {
  heading(text: string, level: number, repoUrl: string): string[];
  commit(commit: Commit, repoUrl: string): string[];
};

type ChangeLogBuildInFormatters = 'markdown';
export type ChangeLogFormat = ChangeLogBuildInFormatters | ChangeLogFormatter;

const formatters: { [key: string]: ChangeLogFormatter } = {
  markdown: {
    heading(text: string, level: number, repoUrl: string) {
      return ['#'.repeat(level) + ` [${text}](${repoUrl}/releases/tag/${text})`];
    },
    commit(commit: Commit, repoUrl: string) {
      const lines: string[] = [];

      if (commit.isMerge) {
        const refs = commit.references && commit.references != '' ? '- ${commit.references}' : '';
        lines.push(
          `- [(#${commit.merge?.pullNumber} - ${commit.body})](${repoUrl}/pull/${commit.merge?.pullNumber}) ${refs}`,
        );
        lines.push(`   `);
      } else {
        lines.push(`- [${commit.subject}](${repoUrl}/commit/${commit.sha1}) ${commit.references}`);
        lines.push(`   `);
        if (commit.body && commit.body !== '') {
          lines.push(`  ${commit.body}`);
          lines.push(`   `);
        }
      }

      lines.push(`  <sup>Date: ${commit.date}, author: [${commit.author}](${commit.email})</sup>  `);
      lines.push(`   `);
      return lines;
    },
  },
};

export function formatTitle(title: string, repoUrl: string, format: ChangeLogFormat): string[] {
  const formatter = typeof format !== 'string' ? format : formatters[format];
  return formatter.heading(title, 1, repoUrl);
}

export function formatCommit(commit: Commit, repoUrl: string, format: ChangeLogFormat): string[] {
  const formatter = typeof format !== 'string' ? format : formatters[format];
  return formatter.commit(commit, repoUrl);
}
