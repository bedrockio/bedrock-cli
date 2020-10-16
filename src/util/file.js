import rimraf from 'rimraf';

export function removeFiles(path) {
  return new Promise((resolve, reject) => {
    try {
      rimraf(path, resolve);
    } catch(err) {
      reject(err);
    }
  });
}
