import { Commit } from './git';
declare type ChangeLogFormatter = {
    heading(text: string, level: number, repoUrl: string): string[];
    commit(commit: Commit, repoUrl: string): string[];
};
declare type ChangeLogBuildInFormatters = 'markdown';
export declare type ChangeLogFormat = ChangeLogBuildInFormatters | ChangeLogFormatter;
export declare function formatTitle(title: string, repoUrl: string, format: ChangeLogFormat): string[];
export declare function formatCommit(commit: Commit, repoUrl: string, format: ChangeLogFormat): string[];
export {};
