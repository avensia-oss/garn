export declare function typecheck(tsConfigPath: string): Promise<{
    hasErrors: boolean;
    errors: string[];
}>;
