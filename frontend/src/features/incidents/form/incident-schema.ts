import * as yup from 'yup'

import type { Criticality, IncidentCategory } from '@/api/types'

import { CATEGORY_ORDER, CRITICALITY_ORDER } from '../constants'

// Mesmas regras da API (backend/app/schemas/incident.py): o erro aparece na hora, sem ida
// ao servidor. A API continua validando tudo de novo (o cliente nunca é a última barreira).

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]

/** Criticidade sugerida ao escolher a categoria (o analista pode mudar). */
export const SUGGESTED_CRITICALITY: Record<IncidentCategory, Criticality> = {
  ACCIDENT_WITH_VICTIMS: 'HIGH',
  VEHICLE_ACCIDENT: 'MEDIUM',
  ROAD_BLOCKED: 'MEDIUM',
  ADVERSE_WEATHER: 'MEDIUM',
  MECHANICAL_FAILURE: 'LOW',
}

/** Aceita minúsculas, hífen e espaço: "abc-1d23" vira "ABC1D23", como a API grava. */
export const normalizePlate = (value: string) => value.replace(/[\s-]/g, '').toUpperCase()

export const incidentSchema = yup.object({
  title: yup
    .string()
    .trim()
    .required('Informe um título.')
    .min(3, 'Use pelo menos 3 caracteres.')
    .max(120, 'Use no máximo 120 caracteres.'),
  category: yup
    .mixed<IncidentCategory>()
    .oneOf(CATEGORY_ORDER, 'Escolha a categoria.')
    .required('Escolha a categoria.'),
  criticality: yup
    .mixed<Criticality>()
    .oneOf(CRITICALITY_ORDER, 'Escolha a criticidade.')
    .required('Escolha a criticidade.'),
  vehicle_plate: yup
    .string()
    .transform((value: string) => normalizePlate(value ?? ''))
    .required('Informe a placa.')
    .matches(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/, 'Placa inválida. Ex.: ABC1D23 ou ABC1234.'),
  highway: yup
    .string()
    .transform((value: string) => (value ?? '').trim().toUpperCase())
    .required('Informe a rodovia.')
    .matches(/^[A-Z]{2}-\d{3}$/, 'Use o formato BR-116.'),
  km: yup
    .number()
    .typeError('Informe o km.')
    .required('Informe o km.')
    .min(0, 'O km não pode ser negativo.')
    .max(9999.9, 'Km acima do permitido.')
    .test('one-decimal', 'Use no máximo uma casa decimal.', (value) =>
      value === undefined ? true : Math.round(value * 10) === value * 10,
    ),
  city: yup
    .string()
    .trim()
    .required('Informe a cidade.')
    .min(2, 'Use pelo menos 2 caracteres.')
    .max(100, 'Use no máximo 100 caracteres.'),
  state: yup.string().oneOf(BRAZILIAN_STATES, 'Escolha a UF.').required('Escolha a UF.'),
  description: yup.string().trim().max(2000, 'Use no máximo 2000 caracteres.').default(''),
})

export type IncidentFormValues = yup.InferType<typeof incidentSchema>
