/// <reference types="node" />
import * as childProcess from 'child_process';
export declare function spawnSync(command: string, args: string[], options?: childProcess.SpawnOptions): {
    stdout: string;
    stderr: string;
};
export declare function spawn(command: string, args: string[], options?: childProcess.SpawnOptions): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function isInPath(command: string): boolean;
export declare function executablePath(executableName: string, variableName: string): Promise<string>;
