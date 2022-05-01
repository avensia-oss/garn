// This contains code that is shared between garn-bin.ts and the rest of the code base.
// This file is only allowed to export utilities and constants, and not contain any shared state.

export const buildsystemPathArgName = 'buildsystem-path';
export const asapArgName = 'asap';
export const compileBuildsystemArgName = 'compile-buildsystem';
export const childGarnArgName = 'child-garn';

export function fromString(valueString: string, type: 'string' | 'number' | 'boolean'): any {
  if (type === 'boolean') {
    return (['y', 'yes', 't', 'true', 'on'].indexOf(valueString.toLowerCase()) !== -1) as unknown;
  } else if (type === 'number') {
    return Number(valueString.replace(',', '.').replace(/[^0-9\.]+/, '')) as unknown;
  }
  return valueString;
}
