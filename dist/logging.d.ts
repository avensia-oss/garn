export declare type LogLevel = 'verbose' | 'info' | 'log' | 'warn' | 'error';
export declare const logLevels: {
    verbose: number;
    info: number;
    log: number;
    warn: number;
    error: number;
};
export declare function verbose(...messages: any[]): Promise<void>;
export declare function info(...messages: any[]): Promise<void>;
export declare function log(...messages: any[]): Promise<void>;
export declare function warn(...messages: any[]): Promise<void>;
export declare function error(...messages: any[]): Promise<void>;
export declare function errorAndThrow(...messages: any[]): Promise<never>;
