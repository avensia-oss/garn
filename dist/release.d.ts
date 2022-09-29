/**
 * # Different types of releases
 * We support tagging of 3 different types of tags
 * * release
 * * release-candidate
 * * base-prerelease
 *
 * ## release
 * Tagging the next release will find the next unused major/minor/patch stable version x.y.z
 * and create package-name@x.y.z tag
 *
 * ## release-candidate
 * Tagging the next release-candidate will find the next available major/minor/patch version x.y.z
 * and create package-name@x.y.z-prereleaseName.iteration tag
 *
 * ## base-prerelease
 * Tagging the next base-prerelease will find the latest stable a.b.c
 * and create package-name@a.b.c-prereleaseName.iteration tag
 *
 * # Examples:
 *
 * ## pre conditions
 * the following tags exist (from newest to oldest):
 * * esales@0.2.3-testing.1
 * * esales@0.2.4-rc.1
 * * esales@0.2.3
 * * esales@0.2.3-rc.2
 * * esales@0.2.3-rc.1
 *
 * ## Create a new release-candidate for esales package with patch bump and default prereleaseName
 * ### post conditions
 * esales@0.2.4-rc.2 exists
 *
 * ## Create a new release-candidate for esales package with minor bump and default prereleaseName
 * ### post conditions
 * esales@0.3.0-rc.1 exists
 *
 * ## Create a new release for esales package with minor bump
 * ### post conditions
 * esales@0.2.4 exists
 *
 * ## Create a new base-prerelease for esales package with prereleaseName testing
 * ### post conditions
 * esales@0.2.3-testing.2 exists
 *
 * ## Create a new base-prerelease for esales package with prereleaseName testingSomethingElse
 * ### post conditions
 * esales@0.2.3-testingSomethingElse.1 exists
 */
export declare enum ReleaseType {
    Release = 0,
    ReleaseCandidate = 1,
    BasePrerelease = 2
}
export declare function tagBasePrerelease(prereleaseTag?: string, releaseBranch?: string): Promise<false | undefined>;
export declare function tagRelease(releaseBranch?: string): Promise<false | undefined>;
export declare function tagPrerelease(prereleaseTag?: string, releaseBranch?: string): Promise<false | undefined>;
export declare function tagPackagesBasePrerelease(packages: string[], prereleaseTag?: string, releaseBranch?: string): Promise<false | undefined>;
export declare function tagPackagesPrerelease(packages: string[], prereleaseTag?: string, releaseBranch?: string): Promise<false | undefined>;
export declare function tagPackagesRelease(packages: string[], releaseBranch?: string): Promise<false | undefined>;
