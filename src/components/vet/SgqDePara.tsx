// De-para fixo da integração com o portal SGQ: qual campo do portal vai para
// qual campo do EquiCore. Mantido junto do código de importação
// (src/lib/sgq/sync.ts) — ao mudar o que é importado, atualize aqui.

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
      ['Classificação',       'Classificação', 'Só "OUTRO"; as siglas do portal (CR, FC, JC) não têm equivalente'],
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
    ],
  },
];

const NOT_IMPORTED = [
  'Exames, requisições e laudos (AIE, mormo, brucelose, tuberculose)',
  'Vacinas, vermifugações, medicamentos, pesagens, reprodução e observações clínicas',
  'Foto do animal e imagem do resenho',
  'Endereço, Nº OESA e quantidade de animais da propriedade',
  'Em qual propriedade cada animal está (o portal não informa na ficha)',
];

const cell: React.CSSProperties = {
  padding: '0.4rem 0.5rem', fontSize: '0.8125rem', textAlign: 'left', verticalAlign: 'top',
  borderTop: `1px solid ${C.border}`,
};

export default function SgqDePara() {
  return (
    <div style={{ marginTop: '0.75rem' }}>
      {GROUPS.map(group => (
        <div key={group.title} style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>{group.title}</h3>
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
        </div>
      ))}

      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg }}>Ainda não é importado</h3>
      <ul style={{ margin: '0.375rem 0 0', paddingLeft: '1.1rem' }}>
        {NOT_IMPORTED.map(item => (
          <li key={item} style={{ fontSize: '0.8125rem', color: C.muted, padding: '0.125rem 0' }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
