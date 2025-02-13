import Listr from 'listr';
import logger from '@bedrockio/logger';

import { exit } from './flow.js';

let currentList;

export function queueTask(title, task) {
  if (!currentList) {
    currentList = getNewList();
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
      logger.info('Nothing to do!');
    }
  } catch (error) {
    exit(error);
  }
}

function getNewList() {
  return new Listr([], {
    collapse: false,
  });
}
