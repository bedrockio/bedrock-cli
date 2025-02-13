import { Listr } from 'listr2';

import { exit } from './flow.js';

let currentList;

export function queueTask(title, task) {
  if (!currentList) {
    currentList = new Listr([]);
  }
  currentList.add({
    title,
    task: async () => {
      currentList = null;
      await task();
      return currentList;
    },
  });
}

export async function runTasks() {
  try {
    if (currentList) {
      await currentList.run();
    } else {
      console.info('Nothing to do!');
    }
  } catch (error) {
    exit(error);
  }
}
