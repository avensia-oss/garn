export declare type ParallelProgram = {
    program: string;
    args: string[];
    prefix?: string;
    cwd?: string;
};
export declare function runInParallel(programs: ParallelProgram[], isGarn?: boolean, maxParallelism?: number): Promise<unknown>;
