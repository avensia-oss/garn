export declare function run(args: string[]): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function build(tag: string, dockerFilePath: string, context?: string): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function tag(image: string, tag: string): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function push(registry: string, image: string): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function login(registry: string, username: string, password: string): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function logout(registry: string): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function exec(container: string, command: string, args: string[]): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function createVolume(name: string): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function remove(container: string): Promise<void>;
