import inquirer from 'inquirer';
import { flags } from './cli-args';

export type PromptOptions = {
  pattern: RegExp;
};

export async function question(q: string, options?: PromptOptions) {
  if (await flags.noPrompt.get()) {
    return '';
  }
  const answer = await inquirer.prompt({
    name: 'question',
    type: 'input',
    message: q,
    validate: input => {
      if (!options?.pattern) {
        return true;
      }
      return options.pattern.test(input);
    },
  });
  return answer['question'] as string;
}

export async function answersYes(q: string) {
  if (await flags.noPrompt.get()) {
    return false;
  }
  const answer = await inquirer.prompt({
    name: 'question',
    type: 'confirm',
    message: q,
  });
  return answer['question'] as boolean;
}

export async function selectOption<T = string>(
  q: string,
  options: string[] | { name: string; value: T }[],
  defaultValue?: T,
) {
  if (await flags.noPrompt.get()) {
    throw new Error(`Can't call prompt.selectOption() when running on a CI server or with the --no-prompt flag`);
  }
  const answer = await inquirer.prompt({
    name: 'question',
    type: 'list',
    choices: options,
    message: q,
    default: defaultValue,
  });
  return answer['question'] as T;
}

export async function selectOptions<T = string>(q: string, options: { name: string; value: T; checked: boolean }[]) {
  if (await flags.noPrompt.get()) {
    throw new Error(`Can't call prompt.selectOptions() when running on a CI server or with the --no-prompt flag`);
  }

  const answer = await inquirer.prompt({
    name: 'question',
    type: 'checkbox',
    choices: options,
    message: q,
  });
  return answer['question'] as T[];
}
