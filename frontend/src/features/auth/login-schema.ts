import * as yup from 'yup'

export const loginSchema = yup.object({
  email: yup
    .string()
    .trim()
    .required('Informe o e-mail.')
    .email('Informe um e-mail válido.'),
  password: yup.string().required('Informe a senha.'),
})

export type LoginFormValues = yup.InferType<typeof loginSchema>
