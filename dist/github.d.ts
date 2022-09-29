export declare type LogLevel = 'debug' | 'warn' | 'info' | 'error';
export declare type GitHubConfig = {
    auth: string;
    repo: string;
    org: string;
    app?: string;
    timezone?: string;
    baseUrl?: string;
    logLevel?: LogLevel;
    generateAutoReleaseNotes?: boolean;
};
export declare function CreateRelease(tagName: string, previousTag: string, srcPath: string | undefined, config: GitHubConfig, releaseName?: string): Promise<void>;
