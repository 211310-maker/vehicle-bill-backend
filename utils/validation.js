const yup = require('yup');

const registerSchema = yup.object().shape({
  fullName: yup.string().required().trim().min(5).max(50),
  email: yup.string().email(),
  password: yup.string().required().min(5).max(15),
});
const loginSchema = yup.object().shape({
  username: yup.string().min(2),
  password: yup.string().required().min(2).max(15),
});

async function validate(schema, data) {
  try {
    await schema.validate(data, { abortEarly: false });
  } catch (err) {
    const errors = [];
    if (err.inner.length > 0) {
      err.inner.forEach((e) => {
        errors.push({ message: e.message, pathname: e.path });
      });
    } else {
      errors.push({ message: err.errors[0], pathname: err.path });
    }
    return errors;
  }
}

async function validateRegister(data) {
  return validate(registerSchema, data);
}
async function validateLogin(data) {
  return validate(loginSchema, data);
}

module.exports = {
  validateLogin,
  validateRegister,
};
