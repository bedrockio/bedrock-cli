import Listr from 'listr';

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
      console.info('Nothing to do!');
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

function getNewList() {
  return new Listr([], {
    collapse: false,
  });
}
