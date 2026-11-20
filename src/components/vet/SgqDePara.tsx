// De-para fixo da integração com o portal SGQ: qual campo do portal vai para
// qual campo do EquiCore. Mantido junto do código de importação
// (src/lib/sgq/sync.ts) — ao mudar o que é importado, atualize aqui.

import { useState } from 'react';

const C = {
  fg:     'hsl(var(--foreground))',
  muted:  'hsl(var(--muted-foreground))',
  border: 'hsl(var(--border))',
};

interface Group {
  title: string;
  source: string;       // tela do portal
  target: string;       // tela do EquiCore
  rows: [sgq: string, equicore: string, note?: string][];
}

const GROUPS: Group[] = [
  {
    title: 'Proprietário',
    source: 'Proprietário',
    target: 'Cadastros › Proprietário',
    rows: [
      ['Proprietário',       'Nome'],
      ['CPF/CNPJ',           'CPF/CNPJ',        'É a chave que liga o dono ao cadastro dele no EquiCore'],
      ['Cidade - UF',        'Cidade e UF',     '"SÃO GABRIEL - RS" vira São Gabriel / RS'],
      ['Telefone',           'Telefone',        'Formatado: (55) 99999-8888'],
      ['E-mail',             'E-mail'],
      ['Endereço',           'Endereço',        'Vem na etapa das fichas'],
      ['Bairro',             'Bairro',          'Vem na etapa das fichas'],
      ['CEP',                'CEP',             'Vem na etapa das fichas'],
      ['Número do produtor', 'Nº do Produtor',  'Vem na etapa das fichas'],
    ],
  },
  {
    title: 'Propriedade',
    source: 'Propriedade',
    target: 'Cadastros › Propriedade',
    rows: [
      ['Nome da Propriedade', 'Nome'],
      ['Município - UF',      'Cidade e UF'],
      ['Classificação',       'Classificação', 'H → Haras, FC → Fazenda; CR, JC, SH e UM entram por extenso (ex.: Jockey Club)'],
      ['Endereço',            'Endereço',            'Vem na etapa das fichas'],
      ['Cadastro OESA',       'Nº Cadastro OESA',    'Vem na etapa das fichas'],
      ['Animais na propriedade', 'Quantidade de animais', 'Vem na etapa das fichas'],
    ],
  },
  {
    title: 'Animal',
    source: 'Equino (lista e ficha)',
    target: 'Cadastros › Animal',
    rows: [
      ['Nome do Animal',      'Nome'],
      ['Proprietário',        'Proprietário',        'Pelo código do dono na ficha do portal'],
      ['Registro/Marca',      'Registro/Marca',      'Vem na etapa das fichas'],
      ['Nº do Chip',          'Nº Chip',             'Vem na etapa das fichas'],
      ['Espécie',             'Espécie',             'EQUINA → Equina, ASININO → Asinina, MUAR → Muar'],
      ['Raça',                'Raça',                'SRD → Sem Raça Definida (SRD); sem equivalente, mantém o nome do portal'],
      ['Pelagem',             'Pelagem',             'CASTANHO → Castanha, ALAZA → Alazã; sem equivalente, mantém o nome do portal'],
      ['Sexo',                'Sexo',                'MACHO → Macho, FÊMEA → Fêmea'],
      ['Data de Nascimento',  'Data de nascimento',  'Vem na etapa das fichas'],
      ['Idade',               'Idade',               'Calculada pela data de nascimento'],
      ['Descrição de Sinais', 'Descrição de sinais', 'Vem na etapa das fichas'],
      ['Resenho do animal',   'Resenha gráfica',     'A imagem é copiada para o EquiCore'],
      ['Foto do animal',      'Foto (portal SGQ)',   'Aparece no histórico do animal; não ocupa os 4 ângulos do cadastro'],
      ['Propriedade da última requisição', 'Propriedade', 'O portal só informa a propriedade na requisição de exame'],
    ],
  },
  {
    title: 'Exames',
    source: 'AIE (IDGA), AIE (ELISA) e Mormo (ELISA)',
    target: 'Registros › Exames e histórico',
    rows: [
      ['Requisição',         'Requisição',  'Nº PCR; é o que evita duplicar ao sincronizar de novo'],
      ['Tipo',               'Exame'],
      ['Animal',             'Animal',      'Pela ficha do animal; antes disso, por proprietário + nome'],
      ['Data da requisição', 'Requisição (data)'],
      ['Colheita',           'Colheita',    'A validade mostrada é estimada: 60 dias após a colheita'],
      ['Laboratório',        'Laboratório'],
      ['Laudo',              'Laudo (PDF)', 'O PDF é buscado no portal quando você abre e fica guardado'],
    ],
  },
  {
    title: 'Histórico de saúde',
    source: 'Ficha do animal',
    target: 'Registros › Exames e histórico',
    rows: [
      ['Vacinações',            'Vacinas',              'Aplicação, vacina, produto, próxima dose, situação'],
      ['Vermifugações',         'Vermifugações',        'Aplicação, produto, dose, próxima, situação'],
      ['Medicamentos',          'Medicamentos',         'Início, medicamento, dose, fim, situação'],
      ['Pesagens',              'Pesagens',             'Data, peso, variação, ECC, método'],
      ['Eventos reprodutivos',  'Reprodução',           'Data, evento, reprodutor(a), método, resultado, previsão'],
      ['Observações clínicas',  'Observações clínicas', 'Data, tipo, título, descrição, retorno'],
    ],
  },
];

const NOT_IMPORTED = [
  'Requisições de brucelose e tuberculose (são por proprietário e lote de amostras, não por animal)',
  'Resultado do exame (positivo/negativo): está só dentro do PDF do laudo',
  'Agenda e alertas calculados pelo portal',
];

const cell: React.CSSProperties = {
  padding: '0.4rem 0.5rem', fontSize: '0.8125rem', textAlign: 'left', verticalAlign: 'top',
  borderTop: `1px solid ${C.border}`,
};

export default function SgqDePara() {
  const [active, setActive] = useState(0);
  const group = GROUPS[active];

  return (
    <div style={{ marginTop: '0.875rem' }}>
      <div role="tablist" aria-label="Cadastro" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '0.875rem' }}>
        {GROUPS.map((g, i) => (
          <button key={g.title} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)}
                  style={{
                    padding: '0.3rem 0.75rem', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${i === active ? 'hsl(221 83% 53%)' : C.border}`,
                    background: i === active ? 'hsl(221 83% 53% / 0.08)' : 'transparent',
                    color: i === active ? 'hsl(221 83% 45%)' : C.muted,
                  }}>
            {g.title}
          </button>
        ))}
      </div>

      <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: '0.375rem' }}>
        Do portal SGQ: {group.source} · Para o EquiCore: {group.target}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
          <thead>
            <tr>
              {['No portal SGQ', 'No EquiCore', 'Observação'].map(h => (
                <th key={h} style={{ ...cell, borderTop: 'none', fontSize: '0.75rem', fontWeight: 600, color: C.muted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.rows.map(([sgq, equicore, note]) => (
              <tr key={sgq}>
                <td style={{ ...cell, color: C.fg, width: '28%' }}>{sgq}</td>
                <td style={{ ...cell, color: C.fg, fontWeight: 600, width: '28%' }}>{equicore}</td>
                <td style={{ ...cell, color: C.muted }}>{note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details style={{ marginTop: '1rem' }}>
        <summary style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.fg, cursor: 'pointer' }}>O que ainda não é importado</summary>
        <ul style={{ margin: '0.375rem 0 0', paddingLeft: '1.1rem' }}>
          {NOT_IMPORTED.map(item => (
            <li key={item} style={{ fontSize: '0.8125rem', color: C.muted, padding: '0.125rem 0' }}>{item}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
