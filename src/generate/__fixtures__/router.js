const Router = require('@koa/router');
const Joi = require('joi');

const router = new Router();
const noop = () => {};

function validate(schemas) {
  const fn = () => {};
  fn.schemas = schemas;
  return fn;
}

const passwordField = Joi.string()
  .min(6)
  .message('Your password must be at least 6 characters long. Please try another.');

router
  .param('userId', noop)
  .get('/me', noop)
  .patch(
    '/me',
    validate({
      body: Joi.object({
        name: Joi.string(),
        timeZone: Joi.string(),
      }),
    }),
    noop
  )
  .get('/roles', noop)
  .get('/permissions', noop)
  .post(
    '/search',
    validate({
      body: Joi.object({
        name: Joi.string(),
        role: Joi.string(),
      }),
    }),
    noop
  )
  .get('/:userId', noop)
  .post(
    '/',
    validate({
      body: Joi.object({
        email: Joi.string().lowercase().email().required(),
        name: Joi.string().required(),
        password: passwordField.required(),
        roles: Joi.array().items(
          Joi.object({
            role: Joi.string().required(),
            scope: Joi.string().required(),
          })
        ),
      }),
    }),
    noop
  )
  .patch(
    '/:userId',
    validate({
      body: Joi.object({
        id: Joi.string().strip(),
        email: Joi.string(),
        name: Joi.string(),
        roles: Joi.array().items(
          Joi.object({
            role: Joi.string().required(),
            scope: Joi.string().required(),
          })
        ),
        createdAt: Joi.date().strip(),
        updatedAt: Joi.date().strip(),
      }),
    }),
    noop
  )
  .delete('/:userId', noop);

module.exports = router;
