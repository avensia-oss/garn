export declare let envVariablesFile: string;
export declare function createString(name: string, defaultValue: string | undefined | (() => Promise<string>), question: string, validation?: RegExp | undefined): {
    name: string;
    get(): Promise<string>;
};
export declare function createNumber(name: string, defaultValue: number | undefined | (() => Promise<number>), question: string, validation?: RegExp | undefined): {
    name: string;
    get(): Promise<number | undefined>;
};
export declare function createBoolean(name: string, defaultValue: boolean | (() => Promise<boolean>), question: string): {
    name: string;
    get(): Promise<boolean>;
};
export declare function promptForAllValues(): Promise<void>;
export declare function saveEnvVariable(name: string, value: any): void;
