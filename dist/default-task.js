"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const logging_1 = require("./logging");
const workspace = require("./workspace");
exports.default = () => {
    const padWithSpace = (s, size) => {
        while (s.length < size) {
            s = s + ' ';
        }
        return s;
    };
    let size = Object.keys(index_1.tasks)
        .map(t => t.length)
        .reduce((a, b) => (a < b ? b : a), 0);
    const internalTaskNames = Object.keys(index_1.tasks).filter(taskName => index_1.tasks[taskName].isInternalTask);
    size = internalTaskNames.map(t => t.length).reduce((a, b) => (a < b ? b : a), 0);
    if (internalTaskNames.length) {
        (0, logging_1.log)('');
        (0, logging_1.log)('Internal tasks that can be called as a dependant task:');
        (0, logging_1.log)('-----------------------------------------------------');
        internalTaskNames.forEach(taskName => {
            (0, logging_1.log)(padWithSpace(taskName, size));
        });
    }
    const workspaces = workspace.list();
    if (workspaces && workspaces.length) {
        (0, logging_1.log)('');
        (0, logging_1.log)('Available workspaces:');
        (0, logging_1.log)('---------------------');
        for (const workspace of workspaces) {
            (0, logging_1.log)(workspace.name);
        }
        (0, logging_1.log)('');
        (0, logging_1.log)('You can invoke tasks inside a workspace by calling:');
        (0, logging_1.log)('garn [workspace name] [workspace task name]');
        (0, logging_1.log)('');
        (0, logging_1.log)('You can run all tasks with the same name in all workspaces by calling:');
        (0, logging_1.log)('garn workspace [task name]');
        (0, logging_1.log)('');
    }
    (0, logging_1.log)('');
    (0, logging_1.log)('Available tasks to run:');
    (0, logging_1.log)('-----------------------');
    const taskNames = Object.keys(index_1.tasks).filter(taskName => !index_1.tasks[taskName].isInternalTask && taskName !== 'default');
    taskNames.sort();
    taskNames.forEach(taskName => {
        (0, logging_1.log)(taskName);
    });
};
//# sourceMappingURL=default-task.js.map