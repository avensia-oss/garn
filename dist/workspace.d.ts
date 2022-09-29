export declare type WorkspacePackage = {
    name: string;
    garnPath: string;
    workspacePath: string;
};
export declare function runTask(taskName: string, packageName?: string): Promise<unknown>;
export declare function runGarnPlugin(): Promise<undefined>;
export declare function current(): WorkspacePackage | undefined;
export declare function getGarnPluginMetaData(): Promise<{
    [pkg: string]: {
        [taskName: string]: string[];
    };
} | undefined>;
export declare function list(): WorkspacePackage[] | undefined;
