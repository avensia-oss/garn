import { tasks } from './index.mjs';
import { log } from './logging.mjs';
import * as workspace from './workspace.mjs';

export default () => {
  const padWithSpace = (s: string, size: number) => {
    while (s.length < size) {
      s = s + ' ';
    }
    return s;
  };

  let size = Object.keys(tasks)
    .map(t => t.length)
    .reduce((a, b) => (a < b ? b : a), 0);

  const internalTaskNames = Object.keys(tasks).filter(taskName => tasks[taskName].isInternalTask);
  size = internalTaskNames.map(t => t.length).reduce((a, b) => (a < b ? b : a), 0);
  if (internalTaskNames.length) {
    log('');
    log('Internal tasks that can be called as a dependant task:');
    log('-----------------------------------------------------');
    internalTaskNames.forEach(taskName => {
      log(padWithSpace(taskName, size));
    });
  }

  const workspaces = workspace.list();

  if (workspaces && workspaces.length) {
    log('');
    log('Available workspaces:');
    log('---------------------');
    for (const workspace of workspaces) {
      log(workspace.name);
    }
    log('');
    log('You can invoke tasks inside a workspace by calling:');
    log('garn [workspace name] [workspace task name]');
  }

  log('');
  log('Available tasks to run:');
  log('-----------------------');
  const taskNames = Object.keys(tasks).filter(taskName => !tasks[taskName].isInternalTask && taskName !== 'default');

  taskNames.sort();
  taskNames.forEach(taskName => {
    log(taskName);
  });
};
