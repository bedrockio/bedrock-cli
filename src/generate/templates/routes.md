--- SYSTEM ---

You will receive multiple tasks. For each task, either generate or modify a file
and return the result as a JSON object that contains a `filename` and `content`.
The final output should be a JSON array of these file objects.

In your code you will:

1. Leave off any explanations or comments.
2. Prefer concise, readable variable names if possible.

--- USER ---

### Task 1 - Generate a new routes file.

- Filename: `{{{expectedRoutesFilename}}}`

Generate a routes file (a Koa router) based on three inputs:

1. The model name:

```
{{{modelName}}}
```

2. The model definition:

```
{{{modelDefinition}}}
```

3. An example routes file. You should follow this as closely as possible:

```
{{{routesExample}}}
```

### Task 2 - Modify the routes entrypoint.

- Filename: `{{{routesEntryFilename}}}`

Modify the following routes entrypoint with the file created from
Task 1 using the following rules:

- Follow the existing patterns.
- If nothing needs to be appended then output the current file as is.

Here is the routes entrypoint:

```
{{{routesEntry}}}
```
