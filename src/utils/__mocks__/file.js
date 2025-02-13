const written = {};

export function readFile(file) {
  if (file.match(/\.json$/)) {
    return {};
  } else {
    return '';
  }
}

export function writeFile(file, data) {
  written[file] = data;
}

export function getWrittenData(file) {
  return JSON.parse(written[file]);
}
