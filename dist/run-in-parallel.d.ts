export declare type ParallelProgram = {
    program: string;
    args: string[];
    prefix?: string;
};
export declare function runInParallel(programs: ParallelProgram[], isGarn?: boolean, maxParallelism?: number): Promise<unknown>;
