let override;

export default function prompts(options) {
  const answers = {};
  for (let key of Object.keys(options)) {
    answers[key] = `fake ${key}`;
  }
  Object.assign(answers, override || {});
  return answers;
}

export function overrides(obj) {
  override = obj;
}
