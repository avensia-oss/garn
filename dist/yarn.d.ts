export declare function runScript(script: string, args?: string[]): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function publishPackage(packageFolderName?: string): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function yarnInfo(): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function runBin(bin: string, args?: string[]): Promise<{
    stdout: string;
    stderr: string;
}>;
