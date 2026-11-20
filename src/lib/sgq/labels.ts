// Tipos e rótulos de exames e histórico de saúde. Arquivo sem dependências:
// é importado também por componentes do navegador.

export const EXAM_TYPES = ['aieidga', 'aieelisa', 'mormoelisa'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const EXAM_LABEL: Record<ExamType, string> = {
  aieidga:    'AIE (IDGA)',
  aieelisa:   'AIE (ELISA)',
  mormoelisa: 'Mormo (ELISA)',
};

export const HEALTH_KINDS = ['vacina', 'vermifugacao', 'medicamento', 'pesagem', 'reproducao', 'observacao'] as const;
export type HealthKind = (typeof HEALTH_KINDS)[number];

export const HEALTH_LABEL: Record<HealthKind, string> = {
  vacina:       'Vacinas',
  vermifugacao: 'Vermifugações',
  medicamento:  'Medicamentos',
  pesagem:      'Pesagens',
  reproducao:   'Reprodução',
  observacao:   'Observações clínicas',
};
