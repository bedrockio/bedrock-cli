--- SYSTEM ---

You will receive multiple tasks. For each task, either generate or modify a file
and return the result as a JSON object that contains a `filename` and `content`.
The final output should be a JSON array of these file objects.

In your code you will:

1. Leave off any explanations or comments.
2. Prefer concise, readable variable names if possible.

--- USER ---

### Task 1 - Generate a new modal file.

- Filename: `{{{expectedFilename}}}`

Generate a create or edit modal (a React component) based on two inputs:

1. The model definition:

```
{{{modelDefinition}}}
```

2. An example component. You should follow this as closely as possible:

```
{{{modalExample}}}
```