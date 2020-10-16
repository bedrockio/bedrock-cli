export function block(chunks, ...values) {
  let lines = chunks.map((chunk, i) => {
    return chunk + (values[i] || '');
  })
    .join('')
    .split('\n')
    .filter((line) => {
      return line.trim().length > 0;
    });
  const indent = lines.reduce((indent, line) => {
    return Math.min(indent, line.match(/\s*/)[0].length);
  }, Infinity);
  lines = lines.map((line) => {
    return line.slice(indent);
  });
  return lines.join('\n').trim();
}

export function indent(str, tabs) {
  if (typeof tabs === 'number') {
    tabs = ' '.repeat(tabs);
  }
  return str
    .split('\n')
    .map((line) => {
      return tabs + line;
    })
    .join('\n');
}
