export declare type PromptOptions = {
    pattern: RegExp;
};
export declare function question(q: string, options?: PromptOptions): Promise<string>;
export declare function answersYes(q: string): Promise<boolean>;
export declare function selectOption(q: string, options: string[] | {
    name: string;
    value: string;
}[], defaultValue?: string): Promise<string>;
export declare function selectOptions(q: string, options: {
    name: string;
    value: string;
    checked: boolean;
}[]): Promise<string[]>;
