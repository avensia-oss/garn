export declare type Version = {
    /** Three digit version, separated by dot. For example: 1.2.3 */
    version: string;
    sha1: string;
    /**
     * Either the full git tag name or undefined if the version not represented as a git tag.
     * Such a version is when a release is generated from the number of commits since the latest
     * tag.
     */
    gitTag?: string;
    packageName?: string;
    prerelease?: Prerelease;
};
export declare type Prerelease = {
    tag: string;
    number: number;
};
/**
 * Returns a string with format X.Y.Z(W) (semver 2.0 https://semver.org/spec/v2.0.0.html)
 * If the current commit has a pre-release, W will be the '-tagname.pre-release-number'.
 */
export declare function formatVersion(version: Version): string;
export declare function currentVersion(): Promise<Version>;
export declare function latestVersion(skipPrereleases?: boolean, packageName?: string, outSkippedPrereleases?: Version[]): Promise<Version>;
export declare function isVersionTag(s: string | null | undefined): s is string;
export declare function fromTag(gitTag: string, includeSha?: boolean): Promise<Version>;
/** Tests that a string matches the pattern `X.Y.Z`, for example `1.2.3` or `10.31.997` */
export declare function isValid(versionNumbers: string): boolean;
export declare function parse(version: Version): number[];
export declare function formatGitTag(packageName: string | undefined, version: string, prereleaseNumber: number | undefined, prereleaseTag: string | undefined): string;
export declare function formatPrerelease(prereleaseTag: string, prereleaseNumber: number): string;
export declare function highest(va: Version, vb: Version): Version | "same";
