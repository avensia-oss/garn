export declare type PackageDetails = {
    name: string;
    version: string;
};
export declare type DotNetOptions = {
    cwd?: string;
    noBuild?: boolean;
    noRestore?: boolean;
};
export declare type DotNetLaunchOptions = DotNetOptions & {
    launchProfile: string;
};
export declare type DotNetTestOptions = DotNetOptions & {
    filter?: string;
};
export declare type DotNetPackOptions = DotNetOptions & {
    force?: boolean;
    excludeSymbols?: boolean;
    excludeSource?: boolean;
    output?: string;
    runtime?: string;
    serviceable?: boolean;
    versionSuffix?: string;
};
export declare type DotNetPushOptions = {
    apiKey?: string;
    source?: string;
    noSymbols?: boolean;
    noSymbolsValue?: string;
    skipDuplicate?: boolean;
    symbolSource?: string;
    symbolApiKey?: string;
};
export declare function listProjects(sln?: string): Promise<string[]>;
export declare function addSolutionProjects(slnPath: string, projectPaths: string[]): Promise<string>;
export declare function removeSolutionProjects(slnPath: string, projectPaths: string[]): Promise<string>;
export declare function listProjectReferences(csprojPath: string): Promise<string[]>;
export declare function addProjectReferences(csprojPath: string, projectPaths: string[]): Promise<string>;
export declare function removeProjectReferences(csprojPath: string, projectPaths: string[]): Promise<string>;
export declare function listProjectPackages(csprojPath: string): Promise<PackageDetails[]>;
export declare function addPackage(csprojPath: string, projectPaths: string[]): Promise<string>;
export declare function removePackage(csprojPath: string, projectPaths: string[]): Promise<string>;
export declare function run(project: string, appArgs: string[], options: DotNetLaunchOptions): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function clean(entry?: string, options?: DotNetOptions): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function test(entry?: string, options?: DotNetTestOptions): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function restore(entry?: string, options?: DotNetOptions): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function watchRun(project: string, appArgs: string[], options: DotNetLaunchOptions): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function build(entry?: string, options?: DotNetOptions): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function publish(entry: string, options: DotNetOptions & {
    outputPath: string;
    runtime?: string;
}): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function pack(projectPath: string, options?: DotNetPackOptions): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function nugetPush(binPath: string, packageName: string, options?: DotNetPushOptions): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function solutionPath(targetPath?: string): Promise<string | undefined>;
