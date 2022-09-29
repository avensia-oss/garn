import * as cliArgs from './cli-args';
import * as variables from './variables';
import * as log from './logging';
import * as prompt from './prompt';
import * as workspace from './workspace';
declare type Workpace = typeof workspace;
declare type ExternalWorkspace = Omit<Workpace, 'runGarnPlugin' | 'getGarnPluginMetaData'>;
declare const exportedWorkspace: ExternalWorkspace;
export { log };
export { variables };
export { exportedWorkspace as workspaces };
export { prompt };
export { cliArgs };
export { isInPath } from './exec';
export * as version from './version';
export * as release from './release';
export * as docker from './docker';
export * as exec from './exec';
export * as dotnet from './dotnet';
export * as yarn from './yarn';
export * as git from './git';
export * as github from './github';
export * as changelog from './change-log';
export * as typescript from './typescript';
export declare const projectPath: string;
export declare type MetaData = {
    tasks: {
        [taskName: string]: string[];
    };
    plugins: {
        [name: string]: PluginMetaData;
    };
    flags: {
        [name: string]: string[];
    };
};
export declare type PluginMetaData = {
    [name: string]: string[] | PluginMetaData;
};
export declare type Plugin = {
    runGarnPlugin: () => Promise<unknown>;
    getGarnPluginMetaData: () => Promise<PluginMetaData | undefined>;
};
declare type TaskRunner = (dependantTaskResult: any) => any | Promise<any>;
declare type DependantTasks = string[];
declare type DependantTasksOrRunner = DependantTasks | TaskRunner;
declare type OnTaskInit = ((taskNames: string[]) => any | Promise<any>) | string[];
declare type OnTaskSuccess = ((res: any) => any | Promise<void>) | string[];
declare type OnTaskError = ((err: any) => any | Promise<void>) | string[];
declare type OnTaskDone = ((res: any) => any | Promise<void>) | string[];
declare type TaskDescriptor = {
    _onInits: OnTaskInit[];
    isProductionTask: boolean;
    isInternalTask: boolean;
    fullName: string;
    name: string;
    taskGroup: string | undefined;
    dependantTasks: string[];
    /**
     * This will run before any other tasks or dependant tasks run.
     * It can be used to run prerequisite checks to fail the build early
     * if any the build task can't even be started.
     * It can also be used for notifications that task will run.
     * The difference between this and a dependant task is simply the order of when it runs.
     * All `onInit`s for the tasks and dependant tasks will run first, prior to any actual
     * tasks.
     */
    onInit: (onInit: OnTaskInit) => TaskDescriptor;
    /**
     * This will run immediately after this task has completed successfully.
     * Note that it will be called even if tasks after it might fail.
     */
    onSuccess: (onSuccess: OnTaskSuccess) => TaskDescriptor;
    /**
     * This will run immediately after this task has failed.
     */
    onError: (onError: OnTaskError) => TaskDescriptor;
    /**
     * This will run immediately after this task has failed or completed successfully.
     */
    onDone: (onDone: OnTaskDone) => TaskDescriptor;
    run: TaskRunner;
    subArgsJsonFile?: string;
    subArgs?: string[];
};
export declare const tasks: {
    [name: string]: TaskDescriptor;
};
export declare function taskGroup(name: string, creator: () => void): void;
export declare function task(name: string, dependantTasksOrRunner?: DependantTasksOrRunner, t?: TaskRunner): TaskDescriptor;
/** An internal task that can only be run as a dependant task of a top task */
export declare function internalTask(name: string, dependantTasksOrRunner?: DependantTasksOrRunner, taskRunner?: TaskRunner): TaskDescriptor;
/** A production task forces the build into production mode when run */
export declare function productionTask(name: string, dependantTasksOrRunner?: DependantTasksOrRunner, taskRunner?: TaskRunner): TaskDescriptor;
/** An internal production task forces the build into production mode when run and that can only be run as a dependant task of a top task */
export declare function internalProductionTask(name: string, dependantTasksOrRunner?: DependantTasksOrRunner, taskRunner?: TaskRunner): TaskDescriptor;
export declare function taskNameify(taskName: string): string;
export declare function spawnTask(taskName: string, taskGroup?: string): Promise<{
    stdout: string;
    stderr: string;
}>;
export declare function runTask(taskName: string, taskGroup?: string, dependantTaskResult?: any): Promise<any>;
export declare function runTasks(taskNames: string[], taskGroup?: string, dependantTaskResult?: any): Promise<any[]>;
declare type OnInit = (tasks: TaskDescriptor[]) => void | Promise<any>;
/**
 * This runs before the build starts. It can be used to run build notifications or any setup
 * needed before a build runs. Note that it can be limited to a task group by calling it
 * inside the `taskGroup` definition.
 */
export declare function onInit(cb: OnInit): void;
declare type OnError = (taskDescriptor: TaskDescriptor, err: any) => void | Promise<any>;
/**
 * This runs after the build has failed. It can be used to run build notifications or any cleanup
 * needed after a build fails. Note that it can be limited to a task group by calling it
 * inside the `taskGroup` definition.
 */
export declare function onError(cb: OnError): void;
declare type OnSuccess = OnInit;
/**
 * This runs after the build has succeded. It can be used to run build notifications or any cleanup
 * needed after a build completes. Note that it can be limited to a task group by calling it
 * inside the `taskGroup` definition.
 */
export declare function onSuccess(cb: OnSuccess): void;
declare type OnDone = OnInit;
/**
 * This runs after the build has succeded or failed. It can be used to run build notifications or any cleanup
 * needed after a build completes. Note that it can be limited to a task group by calling it
 * inside the `taskGroup` definition.
 */
export declare function onDone(cb: OnDone): void;
export declare function garnExecutable(): string;
export declare function run(): Promise<undefined>;
export declare function writeMetaDataIfNotExists(buildCachePath: string): Promise<void>;
export declare function writeMetaData(buildCachePath: string): Promise<void>;
export declare function getMetaData(workspacePath: string, isRetry?: boolean): Promise<MetaData>;
