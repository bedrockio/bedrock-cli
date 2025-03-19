--- SYSTEM ---

You will receive multiple tasks. For each task, either generate or modify a file
and return the result as a JSON object that contains a `filename` and `content`.
The final output should be a JSON array of these file objects.

In your code you will:

1. Leave off any explanations or comments.
2. Prefer concise, readable variable names if possible.

--- USER ---

### Task - Generate a test file that tests the router provided below.

- Filename: `{{{expectedFilename}}}`

Use the following rules which follow the example file:

- Use a single "describe" block for the entire router.
- Use a "describe" block for each route.
- Use Jest style matchers.
- Do not comment the code.
- Follow the example file as closely as you can.
- Assume that test helpers like `createUser`, `createAdmin` etc are available.
- Focus on testing the route itself, not the middelware. For example you do not
  need to test that the authentication middleware is working for each route,
  however it might make sense to do this once in all of the tests.
- If routes rely on time (ie. call `new Date()` etc.) then use the time mocks
  available in `utils/testing/time` to wrap each test and mock the time using:
    - `mockTime`
    - `unmockTime`
    - `advanceTime`
- If routes do NOT rely on the time then do not import these helpers.
- Do NOT add unknown fields to request blocks unless they are in the example file.

Here is the model definition file:

```
{{{modelDefinition}}}
```

Here is the routes file:

```
{{{routesContent}}}
```

Here is the example tests file:

```
{{{testsExample}}}
```
