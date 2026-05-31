import { useState } from 'react';
import { z } from 'zod';
import { createClient, PLAN_LIMITS } from '../../lib/supabase';

const equineSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').trim(),
  breed: z.string().min(1, 'Raça é obrigatória'),
  sex: z.string().min(1, 'Sexo é obrigatório'),
  coat: z.string().min(1, 'Pelagem é obrigatória'),
  purpose: z.array(z.string()).optional(),
});

function nullify(val: string | undefined): string | null {
  return val && val.trim() !== '' ? val.trim() : null;
}
function nullifyNum(val: string | undefined): number | null {
  const n = parseFloat(val ?? '');
  return isNaN(n) ? null : n;
}

const C = {
  green: 'hsl(168 83% 29%)',
  greenLight: 'hsl(168 83% 29% / 0.08)',
  greenBorder: 'hsl(168 83% 29% / 0.25)',
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  card: 'hsl(var(--card))',
  border: 'hsl(var(--border))',
  bg: 'hsl(var(--background))',
  muted_bg: 'hsl(var(--muted))',
  amber: 'hsl(38 92% 50%)',
  amberText: 'hsl(38 92% 28%)',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5625rem 0.875rem', borderRadius: '0.625rem',
  border: `1px solid ${C.border}`, background: C.bg, color: C.fg,
  fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: C.fg, marginBottom: '0.375rem',
};

const helperStyle: React.CSSProperties = {
  fontSize: '0.75rem', color: C.muted, marginTop: '0.25rem',
};

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {helper && <p style={helperStyle}>{helper}</p>}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const BREEDS = [
  { value: 'QUARTO_DE_MILHA', label: 'Quarto de Milha' },
  { value: 'MANGALARGA_MARCHADOR', label: 'Mangalarga Marchador' },
  { value: 'PURO_SANGUE_INGLES', label: 'Puro Sangue Inglês' },
  { value: 'LUSITANO', label: 'Lusitano' },
  { value: 'BRASILEIRO_DE_HIPISMO', label: 'Brasileiro de Hipismo' },
  { value: 'CRIOULO', label: 'Crioulo' },
  { value: 'CAMPOLINA', label: 'Campolina' },
  { value: 'APPALOOSA', label: 'Appaloosa' },
  { value: 'PAINT_HORSE', label: 'Paint Horse' },
  { value: 'ANDALUZ', label: 'Andaluz' },
  { value: 'ARABE', label: 'Árabe' },
  { value: 'HAFLINGER', label: 'Haflinger' },
  { value: 'FRIESIO', label: 'Frísio' },
  { value: 'ARDENÊS', label: 'Ardenês' },
  { value: 'OTHER', label: 'Outra raça' },
];

const SEX_OPTIONS = [
  { value: 'GARANHAO', label: 'Garanhão (Macho inteiro)' },
  { value: 'CASTRADO', label: 'Castrado' },
  { value: 'EGUA', label: 'Égua' },
  { value: 'POTRANCA', label: 'Potranca' },
  { value: 'POTRO', label: 'Potro' },
  { value: 'POTRO_CASTRADO', label: 'Potro castrado' },
];

const COAT_OPTIONS = [
  { value: 'ALAZAO', label: 'Alazão' },
  { value: 'TORDILHO', label: 'Tordilho' },
  { value: 'RUAO', label: 'Ruão' },
  { value: 'BAYO', label: 'Baio' },
  { value: 'ZAINO', label: 'Zaino (Castanho)' },
  { value: 'ROSILHO', label: 'Rosilho' },
  { value: 'PAMPA', label: 'Pampa' },
  { value: 'MALHADO', label: 'Malhado' },
  { value: 'PRETO', label: 'Preto' },
  { value: 'BRANCO', label: 'Branco' },
  { value: 'ISABELA', label: 'Isabela' },
  { value: 'PALOMINO', label: 'Palomino' },
  { value: 'OTHER', label: 'Outro' },
];

const PURPOSE_OPTIONS = [
  { value: 'ESPORTE_HIPISMO', label: 'Hipismo' },
  { value: 'ESPORTE_VAQUEJADA', label: 'Vaquejada' },
  { value: 'ESPORTE_LACO', label: 'Laço' },
  { value: 'ESPORTE_POLO', label: 'Polo' },
  { value: 'ESPORTE_ENDURO', label: 'Enduro' },
  { value: 'ESPORTE_CCE', label: 'CCE' },
  { value: 'ESPORTE_DRESSAGE', label: 'Dressage' },
  { value: 'REPRODUCAO', label: 'Reprodução' },
  { value: 'TRABALHO', label: 'Trabalho' },
  { value: 'LAZER', label: 'Lazer / Passeio' },
  { value: 'EXPOSICAO', label: 'Exposição' },
  { value: 'CRIACAO', label: 'Criação' },
];

const STEPS = [
  { id: 1, label: 'Identificação', short: 'ID' },
  { id: 2, label: 'Registros', short: 'REG' },
  { id: 3, label: 'Físico', short: 'FÍS' },
  { id: 4, label: 'Genealogia', short: 'GEN' },
  { id: 5, label: 'Revisão', short: 'REV' },
];

type FormData = {
  name: string; nickname: string; breed: string; breedOther: string;
  sex: string; coat: string; coatOther: string;
  birthDate: string; estimatedAge: string;
  microchipNumber: string; brandDescription: string;
  purpose: string[]; stable: string; property: string;
  abqmRegistry: string; abccmRegistry: string; abpsiRegistry: string;
  abccrRegistry: string; otherRegistry: string; registryEntity: string;
  passportNumber: string;
  competitionLevel: string; trainingStatus: string;
  dailyFeedKg: string; feedBrand: string; hayKgDay: string; hayType: string;
  waterAccess: string; supplements: string;
  weightKg: string; heightCm: string; lastWeightDate: string;
  bodyConditionScore: string;
  isPregnant: boolean; expectedFoalingDate: string; breedingMethod: string;
  fatherName: string; fatherReg: string;
  motherName: string; motherReg: string;
  paternalGrandfatherName: string; paternalGrandmotherName: string;
  maternalGrandfatherName: string; maternalGrandmotherName: string;
};

const emptyForm: FormData = {
  name: '', nickname: '', breed: '', breedOther: '', sex: '', coat: '', coatOther: '',
  birthDate: '', estimatedAge: '', microchipNumber: '', brandDescription: '',
  purpose: [], stable: '', property: '',
  abqmRegistry: '', abccmRegistry: '', abpsiRegistry: '', abccrRegistry: '',
  otherRegistry: '', registryEntity: '', passportNumber: '',
  competitionLevel: '', trainingStatus: '',
  dailyFeedKg: '', feedBrand: '', hayKgDay: '', hayType: '', waterAccess: '', supplements: '',
  weightKg: '', heightCm: '', lastWeightDate: '', bodyConditionScore: '',
  isPregnant: false, expectedFoalingDate: '', breedingMethod: '',
  fatherName: '', fatherReg: '', motherName: '', motherReg: '',
  paternalGrandfatherName: '', paternalGrandmotherName: '',
  maternalGrandfatherName: '', maternalGrandmotherName: '',
};

function rowToForm(row: any): FormData {
  return {
    name: row.name ?? '', nickname: row.nickname ?? '',
    breed: row.breed ?? '', breedOther: row.breed_other ?? '',
    sex: row.sex ?? '', coat: row.coat ?? '', coatOther: row.coat_other ?? '',
    birthDate: row.birth_date ?? '', estimatedAge: row.estimated_age?.toString() ?? '',
    microchipNumber: row.microchip ?? '', brandDescription: row.brand_desc ?? '',
    purpose: row.purpose ?? [], stable: row.stable ?? '', property: '',
    abqmRegistry: row.reg_abqm ?? '', abccmRegistry: row.reg_abccm ?? '',
    abpsiRegistry: row.reg_abpsi ?? '', abccrRegistry: row.reg_abccc ?? '',
    otherRegistry: row.reg_other ?? '', registryEntity: row.reg_entity ?? '',
    passportNumber: row.passport ?? '',
    competitionLevel: row.competition_level ?? '', trainingStatus: row.training_status ?? '',
    dailyFeedKg: row.feed_kg_day?.toString() ?? '', feedBrand: row.feed_brand ?? '',
    hayKgDay: row.hay_kg_day?.toString() ?? '', hayType: row.hay_type ?? '',
    waterAccess: row.water_access ?? '', supplements: row.supplements ?? '',
    weightKg: row.weight_kg?.toString() ?? '', heightCm: row.height_cm?.toString() ?? '',
    lastWeightDate: row.last_weight ?? '', bodyConditionScore: row.bcs?.toString() ?? '',
    isPregnant: row.is_pregnant ?? false, expectedFoalingDate: row.foaling_date ?? '',
    breedingMethod: row.breeding_method ?? '',
    fatherName: row.father_name ?? '', fatherReg: row.father_reg ?? '',
    motherName: row.mother_name ?? '', motherReg: row.mother_reg ?? '',
    paternalGrandfatherName: row.pat_grandfather ?? '', paternalGrandmotherName: row.pat_grandmother ?? '',
    maternalGrandfatherName: row.mat_grandfather ?? '', maternalGrandmotherName: row.mat_grandmother ?? '',
  };
}

function CheckboxGroup({ options, selected, onChange }: { options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(active ? selected.filter(v => v !== o.value) : [...selected, o.value])}
            style={{ padding: '5px 14px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 600, border: `1.5px solid ${active ? C.green : C.border}`, background: active ? C.greenLight : 'transparent', color: active ? C.green : C.muted, cursor: 'pointer', transition: 'all 0.15s' }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function BCSSlider({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const descriptions = ['', 'Emaciado', 'Muito magro', 'Magro', 'Moderadamente magro', 'Ideal', 'Moderadamente gordo', 'Gordo', 'Muito gordo', 'Extremamente gordo'];
  const n = parseInt(value) || 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={labelStyle}>Escore Corporal (Henneke 1–9)</span>
        {n > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: n < 4 ? C.amber : n > 7 ? C.amber : C.green }}>{n} — {descriptions[n]}</span>}
      </div>
      <input type="range" min="1" max="9" step="1" value={value || '5'} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', accentColor: C.green }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
        <span style={{ fontSize: '0.6875rem', color: C.muted }}>1 — Emaciado</span>
        <span style={{ fontSize: '0.6875rem', color: C.muted }}>5 — Ideal</span>
        <span style={{ fontSize: '0.6875rem', color: C.muted }}>9 — Extremamente gordo</span>
      </div>
    </div>
  );
}

function Step1({ f, set }: { f: FormData; set: (k: keyof FormData, v: any) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Nome do equino *" helper="Nome de registro ou nome popular">
            <input type="text" value={f.name} onChange={e => set('name', e.target.value)} placeholder="Ex.: Trovão do Sul" required style={inputStyle} />
          </Field>
        </div>
        <Field label="Apelido / Nome de pista">
          <input type="text" value={f.nickname} onChange={e => set('nickname', e.target.value)} placeholder="Ex.: Trovão" style={inputStyle} />
        </Field>
        <Field label="Raça *">
          <Select value={f.breed} onChange={v => set('breed', v)} options={BREEDS} placeholder="Selecione a raça" />
        </Field>
        {f.breed === 'OTHER' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Especifique a raça">
              <input type="text" value={f.breedOther} onChange={e => set('breedOther', e.target.value)} placeholder="Nome da raça" style={inputStyle} />
            </Field>
          </div>
        )}
        <Field label="Sexo *">
          <Select value={f.sex} onChange={v => set('sex', v)} options={SEX_OPTIONS} placeholder="Selecione o sexo" />
        </Field>
        <Field label="Pelagem *">
          <Select value={f.coat} onChange={v => set('coat', v)} options={COAT_OPTIONS} placeholder="Selecione a pelagem" />
        </Field>
        <Field label="Data de nascimento" helper="Ou informe a idade estimada ao lado">
          <input type="date" value={f.birthDate} onChange={e => set('birthDate', e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Idade estimada (meses)" helper="Use quando não souber a data exata">
          <input type="number" min={1} max={600} value={f.estimatedAge} onChange={e => set('estimatedAge', e.target.value)} placeholder="Ex.: 84 (7 anos)" style={inputStyle} disabled={!!f.birthDate} />
        </Field>
        <Field label="Nº microchip (RFID)" helper="15 dígitos — obrigatório em alguns estados">
          <input type="text" value={f.microchipNumber} onChange={e => set('microchipNumber', e.target.value)} placeholder="000000000000000" maxLength={15} style={inputStyle} />
        </Field>
        <Field label="Baia / Piquete">
          <input type="text" value={f.stable} onChange={e => set('stable', e.target.value)} placeholder="Ex.: Baia 04" style={inputStyle} />
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Resenha / Sinais" helper="Descreva marcas naturais, marcas a ferro, estrela, calçados, etc.">
            <textarea value={f.brandDescription} onChange={e => set('brandDescription', e.target.value)} placeholder="Ex.: Estrela oval na testa, calçado do bipé posterior esquerdo, marca a ferro no quadril direito (HCS)." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Finalidade / Uso</label>
          <CheckboxGroup options={PURPOSE_OPTIONS} selected={f.purpose} onChange={v => set('purpose', v)} />
        </div>
      </div>
    </div>
  );
}

function Step2({ f, set }: { f: FormData; set: (k: keyof FormData, v: any) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', background: C.greenLight, border: `1px solid ${C.greenBorder}`, fontSize: '0.8125rem', color: C.green, fontWeight: 500 }}>
        Informe os registros oficiais que o equino possui. Campos não preenchidos serão ignorados.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Field label="Registro ABQM" helper="Quarto de Milha">
          <input type="text" value={f.abqmRegistry} onChange={e => set('abqmRegistry', e.target.value)} placeholder="ABQM 2020/00000" style={inputStyle} />
        </Field>
        <Field label="Registro ABCCM" helper="Mangalarga Marchador">
          <input type="text" value={f.abccmRegistry} onChange={e => set('abccmRegistry', e.target.value)} placeholder="ABCCM 2020/00000" style={inputStyle} />
        </Field>
        <Field label="Registro ABPSI" helper="Puro Sangue Inglês">
          <input type="text" value={f.abpsiRegistry} onChange={e => set('abpsiRegistry', e.target.value)} placeholder="ABPSI 2020/00000" style={inputStyle} />
        </Field>
        <Field label="Registro ABCCC" helper="Crioulo">
          <input type="text" value={f.abccrRegistry} onChange={e => set('abccrRegistry', e.target.value)} placeholder="ABCCC 2020/00000" style={inputStyle} />
        </Field>
        <Field label="Outro registro">
          <input type="text" value={f.otherRegistry} onChange={e => set('otherRegistry', e.target.value)} placeholder="Número do registro" style={inputStyle} />
        </Field>
        <Field label="Entidade responsável">
          <input type="text" value={f.registryEntity} onChange={e => set('registryEntity', e.target.value)} placeholder="Ex.: ABCCMM, ANCCE" style={inputStyle} />
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Número do passaporte equino" helper="Passaporte emitido pela associação de raça ou pela ANCP">
            <input type="text" value={f.passportNumber} onChange={e => set('passportNumber', e.target.value)} placeholder="Número do passaporte" style={inputStyle} />
          </Field>
        </div>
      </div>
      <p style={{ fontSize: '0.8125rem', color: C.muted, fontStyle: 'italic' }}>
        💡 Sem registro ainda? Clique em "Próximo" — você pode adicionar depois no perfil do equino.
      </p>
    </div>
  );
}

function Step3({ f, set }: { f: FormData; set: (k: keyof FormData, v: any) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Field label="Nível de competição">
          <Select value={f.competitionLevel} onChange={v => set('competitionLevel', v)} options={[{ value: 'Regional', label: 'Regional' }, { value: 'Nacional', label: 'Nacional' }, { value: 'Internacional', label: 'Internacional' }, { value: 'Amateur', label: 'Amador / Lazer' }]} placeholder="Selecione" />
        </Field>
        <Field label="Status de treinamento">
          <Select value={f.trainingStatus} onChange={v => set('trainingStatus', v)} options={[{ value: 'Em treinamento', label: 'Em treinamento' }, { value: 'Treinado', label: 'Treinado' }, { value: 'Em repouso', label: 'Em repouso' }, { value: 'Potro', label: 'Potro / Não iniciado' }]} placeholder="Selecione" />
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Finalidade selecionada anteriormente</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {f.purpose.length === 0
              ? <span style={{ fontSize: '0.8125rem', color: C.muted }}>Nenhuma finalidade selecionada na etapa anterior</span>
              : f.purpose.map(p => {
                const opt = PURPOSE_OPTIONS.find(o => o.value === p);
                return (
                  <span key={p} style={{ padding: '4px 12px', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 600, background: C.greenLight, color: C.green }}>
                    {opt?.label ?? p}
                  </span>
                );
              })
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function Step4({ f, set }: { f: FormData; set: (k: keyof FormData, v: any) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Field label="Ração diária (kg)" helper="Quantidade de concentrado por dia">
          <input type="number" step="0.1" min={0} max={50} value={f.dailyFeedKg} onChange={e => set('dailyFeedKg', e.target.value)} placeholder="Ex.: 6.0" style={inputStyle} />
        </Field>
        <Field label="Marca da ração">
          <input type="text" value={f.feedBrand} onChange={e => set('feedBrand', e.target.value)} placeholder="Ex.: Nutrequi Performance" style={inputStyle} />
        </Field>
        <Field label="Feno (kg/dia)">
          <input type="number" step="0.1" min={0} max={50} value={f.hayKgDay} onChange={e => set('hayKgDay', e.target.value)} placeholder="Ex.: 8.0" style={inputStyle} />
        </Field>
        <Field label="Tipo de feno">
          <Select value={f.hayType} onChange={v => set('hayType', v)} options={[{ value: 'Tifton', label: 'Tifton' }, { value: 'Coast-Cross', label: 'Coast-Cross' }, { value: 'Bermuda', label: 'Bermuda' }, { value: 'Fenação', label: 'Fenação' }, { value: 'Capim-elefante', label: 'Capim-elefante' }, { value: 'Outro', label: 'Outro' }]} placeholder="Selecione" />
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Acesso à água">
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ v: 'LIVRE', l: 'Livre acesso (ad libitum)' }, { v: 'CONTROLADO', l: 'Controlado' }].map(o => (
                <label key={o.v} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: '0.625rem', border: `1.5px solid ${f.waterAccess === o.v ? C.green : C.border}`, background: f.waterAccess === o.v ? C.greenLight : 'transparent', flex: 1, transition: 'all 0.15s' }}>
                  <input type="radio" name="water" value={o.v} checked={f.waterAccess === o.v} onChange={() => set('waterAccess', o.v)} style={{ accentColor: C.green }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: C.fg }}>{o.l}</span>
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Suplementos" helper="Vitaminas, minerais, eletrólitos, etc.">
            <textarea value={f.supplements} onChange={e => set('supplements', e.target.value)} placeholder="Ex.: Vitamina E 1000 UI/dia, Biotina 20 mg, Eletrólitos pós-treino" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Step5({ f, set }: { f: FormData; set: (k: keyof FormData, v: any) => void }) {
  const isFemale = f.sex === 'EGUA' || f.sex === 'POTRANCA';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Field label="Peso (kg)">
          <input type="number" step="1" min={50} max={1500} value={f.weightKg} onChange={e => set('weightKg', e.target.value)} placeholder="Ex.: 480" style={inputStyle} />
        </Field>
        <Field label="Altura na cernelha (cm)" helper="1 palmo = 10 cm">
          <input type="number" step="0.5" min={50} max={250} value={f.heightCm} onChange={e => set('heightCm', e.target.value)} placeholder="Ex.: 155 (15,5 palmos)" style={inputStyle} />
        </Field>
        <Field label="Data da última pesagem">
          <input type="date" value={f.lastWeightDate} onChange={e => set('lastWeightDate', e.target.value)} style={inputStyle} />
        </Field>
        <div />
        <div style={{ gridColumn: '1 / -1' }}>
          <BCSSlider value={f.bodyConditionScore} onChange={v => set('bodyConditionScore', v)} />
        </div>
      </div>

      {isFemale && (
        <div style={{ marginTop: '0.5rem', padding: '1rem', borderRadius: '0.75rem', border: `1px solid ${C.border}`, background: C.muted_bg }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg, marginBottom: '0.75rem' }}>Dados Reprodutivos (Fêmeas)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={f.isPregnant} onChange={e => set('isPregnant', e.target.checked)} style={{ accentColor: C.green, width: 16, height: 16 }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: C.fg }}>Prenha / Gestante</span>
              </label>
            </div>
            {f.isPregnant && (
              <>
                <Field label="Previsão de parto">
                  <input type="date" value={f.expectedFoalingDate} onChange={e => set('expectedFoalingDate', e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Método de cobertura">
                  <Select value={f.breedingMethod} onChange={v => set('breedingMethod', v)} options={[{ value: 'MONTA_NATURAL', label: 'Monta natural' }, { value: 'IA', label: 'IA — Inseminação Artificial' }, { value: 'IATF', label: 'IATF' }]} placeholder="Selecione" />
                </Field>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Step6({ f, set }: { f: FormData; set: (k: keyof FormData, v: any) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', background: C.greenLight, border: `1px solid ${C.greenBorder}`, fontSize: '0.8125rem', color: C.green, fontWeight: 500 }}>
        Genealogia é opcional — você pode pular e adicionar depois. Para pais já cadastrados no sistema, o link direto estará disponível no perfil.
      </div>

      {/* Pais */}
      <div>
        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg, marginBottom: '0.75rem' }}>Pais</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Field label="Nome do pai">
            <input type="text" value={f.fatherName} onChange={e => set('fatherName', e.target.value)} placeholder="Ex.: Vento Forte" style={inputStyle} />
          </Field>
          <Field label="Registro do pai">
            <input type="text" value={f.fatherReg} onChange={e => set('fatherReg', e.target.value)} placeholder="ABQM 2010/00000" style={inputStyle} />
          </Field>
          <Field label="Nome da mãe">
            <input type="text" value={f.motherName} onChange={e => set('motherName', e.target.value)} placeholder="Ex.: Estrela da Manhã" style={inputStyle} />
          </Field>
          <Field label="Registro da mãe">
            <input type="text" value={f.motherReg} onChange={e => set('motherReg', e.target.value)} placeholder="ABQM 2012/00000" style={inputStyle} />
          </Field>
        </div>
      </div>

      {/* Avós */}
      <div>
        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.fg, marginBottom: '0.75rem' }}>Avós (inserção manual)</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <Field label="Avô paterno">
            <input type="text" value={f.paternalGrandfatherName} onChange={e => set('paternalGrandfatherName', e.target.value)} placeholder="Nome" style={inputStyle} />
          </Field>
          <Field label="Avó paterna">
            <input type="text" value={f.paternalGrandmotherName} onChange={e => set('paternalGrandmotherName', e.target.value)} placeholder="Nome" style={inputStyle} />
          </Field>
          <Field label="Avô materno">
            <input type="text" value={f.maternalGrandfatherName} onChange={e => set('maternalGrandfatherName', e.target.value)} placeholder="Nome" style={inputStyle} />
          </Field>
          <Field label="Avó materna">
            <input type="text" value={f.maternalGrandmotherName} onChange={e => set('maternalGrandmotherName', e.target.value)} placeholder="Nome" style={inputStyle} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: `1px solid ${C.border}`, gap: 16 }}>
      <span style={{ fontSize: '0.8125rem', color: C.muted, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.8125rem', color: C.fg, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Step7({ f }: { f: FormData }) {
  const breedLabel = BREEDS.find(b => b.value === f.breed)?.label ?? f.breed;
  const sexLabel = SEX_OPTIONS.find(s => s.value === f.sex)?.label ?? f.sex;
  const coatLabel = COAT_OPTIONS.find(c => c.value === f.coat)?.label ?? f.coat;
  const purposeLabels = f.purpose.map(p => PURPOSE_OPTIONS.find(o => o.value === p)?.label ?? p).join(', ');

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '0.875rem', padding: '1rem', marginBottom: '0.875rem' }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '0.5rem' }}>{title}</p>
      {children}
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: C.muted, marginBottom: '1rem' }}>Revise os dados antes de salvar. Você poderá editar qualquer campo depois.</p>
      {section('Identificação', <>
        <ReviewRow label="Nome" value={f.name || '—'} />
        <ReviewRow label="Apelido" value={f.nickname} />
        <ReviewRow label="Raça" value={breedLabel || '—'} />
        <ReviewRow label="Sexo" value={sexLabel || '—'} />
        <ReviewRow label="Pelagem" value={coatLabel || '—'} />
        <ReviewRow label="Nascimento" value={f.birthDate || (f.estimatedAge ? `~${f.estimatedAge} meses` : undefined)} />
        <ReviewRow label="Microchip" value={f.microchipNumber} />
        <ReviewRow label="Finalidade" value={purposeLabels || '—'} />
        <ReviewRow label="Baia" value={f.stable} />
      </>)}
      {section('Registros Oficiais', <>
        <ReviewRow label="ABQM" value={f.abqmRegistry} />
        <ReviewRow label="ABCCM" value={f.abccmRegistry} />
        <ReviewRow label="ABPSI" value={f.abpsiRegistry} />
        <ReviewRow label="Passaporte" value={f.passportNumber} />
        {!f.abqmRegistry && !f.abccmRegistry && !f.abpsiRegistry && !f.abccrRegistry && !f.otherRegistry && (
          <p style={{ fontSize: '0.8125rem', color: C.muted, fontStyle: 'italic', paddingTop: '0.25rem' }}>Nenhum registro informado</p>
        )}
      </>)}
      {section('Dados Físicos', <>
        <ReviewRow label="Peso" value={f.weightKg ? `${f.weightKg} kg` : undefined} />
        <ReviewRow label="Altura" value={f.heightCm ? `${f.heightCm} cm (${(Number(f.heightCm) / 10).toFixed(1)} palmos)` : undefined} />
        <ReviewRow label="Escore Corporal (BCS)" value={f.bodyConditionScore} />
      </>)}
      {(f.fatherName || f.motherName) && section('Genealogia', <>
        <ReviewRow label="Pai" value={`${f.fatherName}${f.fatherReg ? ` — ${f.fatherReg}` : ''}`} />
        <ReviewRow label="Mãe" value={`${f.motherName}${f.motherReg ? ` — ${f.motherReg}` : ''}`} />
        <ReviewRow label="Avô paterno" value={f.paternalGrandfatherName} />
        <ReviewRow label="Avó paterna" value={f.paternalGrandmotherName} />
      </>)}
    </div>
  );
}

export default function EquineFormStepper({ initialData, equineId }: { initialData?: any; equineId?: string } = {}) {
  const isEdit = !!equineId;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initialData ? rowToForm(initialData) : emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const supabase = createClient();

  function setField(key: keyof FormData, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaveError(null);
    setValidationErrors([]);

    const validation = equineSchema.safeParse({
      name: form.name,
      breed: form.breed,
      sex: form.sex,
      coat: form.coat,
      purpose: form.purpose,
    });

    if (!validation.success) {
      setValidationErrors(validation.error.errors.map((e) => e.message));
      return;
    }

    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/login';
      return;
    }

    // Verificar limite do plano (apenas ao criar)
    if (!isEdit) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', session.user.id)
        .single();

      const plan = profile?.plan ?? 'free';
      const limit = PLAN_LIMITS[plan] ?? 2;

      const { count } = await supabase
        .from('equinos')
        .select('id', { count: 'exact', head: true });

      if ((count ?? 0) >= limit) {
        setSaveError(`Seu plano ${plan.charAt(0).toUpperCase() + plan.slice(1)} permite até ${limit} equinos. Faça upgrade para adicionar mais.`);
        setSaving(false);
        return;
      }
    }

    const payload = {
      user_id: session.user.id,
      name: form.name.trim(),
      nickname: nullify(form.nickname),
      breed: form.breed,
      breed_other: nullify(form.breedOther),
      sex: form.sex,
      coat: form.coat,
      coat_other: nullify(form.coatOther),
      birth_date: nullify(form.birthDate),
      estimated_age: form.birthDate ? null : nullifyNum(form.estimatedAge),
      microchip: nullify(form.microchipNumber),
      brand_desc: nullify(form.brandDescription),
      purpose: form.purpose,
      stable: nullify(form.stable),
      reg_abqm: nullify(form.abqmRegistry),
      reg_abccm: nullify(form.abccmRegistry),
      reg_abpsi: nullify(form.abpsiRegistry),
      reg_abccc: nullify(form.abccrRegistry),
      reg_other: nullify(form.otherRegistry),
      reg_entity: nullify(form.registryEntity),
      passport: nullify(form.passportNumber),
      competition_level: nullify(form.competitionLevel),
      training_status: nullify(form.trainingStatus),
      feed_kg_day: nullifyNum(form.dailyFeedKg),
      feed_brand: nullify(form.feedBrand),
      hay_kg_day: nullifyNum(form.hayKgDay),
      hay_type: nullify(form.hayType),
      water_access: nullify(form.waterAccess),
      supplements: nullify(form.supplements),
      weight_kg: nullifyNum(form.weightKg),
      height_cm: nullifyNum(form.heightCm),
      last_weight: nullify(form.lastWeightDate),
      bcs: nullifyNum(form.bodyConditionScore),
      is_pregnant: form.isPregnant,
      foaling_date: form.isPregnant ? nullify(form.expectedFoalingDate) : null,
      breeding_method: form.isPregnant ? nullify(form.breedingMethod) : null,
      father_name: nullify(form.fatherName),
      father_reg: nullify(form.fatherReg),
      mother_name: nullify(form.motherName),
      mother_reg: nullify(form.motherReg),
      pat_grandfather: nullify(form.paternalGrandfatherName),
      pat_grandmother: nullify(form.paternalGrandmotherName),
      mat_grandfather: nullify(form.maternalGrandfatherName),
      mat_grandmother: nullify(form.maternalGrandmotherName),
    };

    const { error } = isEdit
      ? await supabase.from('equinos').update(payload).eq('id', equineId)
      : await supabase.from('equinos').insert(payload);
    setSaving(false);

    if (error) {
      setSaveError('Erro ao salvar. Tente novamente.');
      return;
    }

    window.location.href = isEdit ? `/dashboard/equino/${equineId}` : '/dashboard/plantel';
  }

  const isFirst = step === 1;
  const isLast = step === 5;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <style>{`
        input[type="range"] { accent-color: ${C.green}; }
        textarea:focus, input:focus, select:focus { outline: none; border-color: ${C.green}; box-shadow: 0 0 0 3px hsl(168 83% 29% / 0.12); }
      `}</style>

      {/* Back */}
      <a href={isEdit ? `/dashboard/equino/${equineId}` : '/dashboard/plantel'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 500, color: C.muted, textDecoration: 'none', marginBottom: '1.5rem' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        {isEdit ? 'Voltar ao perfil' : 'Voltar ao Plantel'}
      </a>

      {/* Title */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: C.fg, letterSpacing: '-0.02em' }}>{isEdit ? 'Editar equino' : 'Cadastrar novo equino'}</h1>
        <p style={{ fontSize: '0.875rem', color: C.muted, marginTop: '0.25rem' }}>Preencha os dados em etapas — você pode salvar parcialmente</p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div
              onClick={() => s.id < step && setStep(s.id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: s.id < step ? 'pointer' : 'default' }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 800, transition: 'all 0.2s',
                background: step > s.id ? C.green : step === s.id ? C.green : 'hsl(var(--muted))',
                color: step >= s.id ? '#fff' : C.muted,
                boxShadow: step === s.id ? `0 0 0 4px ${C.greenLight}` : 'none',
              }}>
                {step > s.id ? '✓' : s.id}
              </div>
              <span style={{ fontSize: '0.625rem', fontWeight: 700, color: step >= s.id ? C.green : C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                {s.short}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 32, height: 2, background: step > s.id ? C.green : 'hsl(var(--muted))', margin: '0 4px', marginBottom: 20, borderRadius: 2, transition: 'background 0.3s' }} />
            )}
          </div>
        ))}
      </div>

      {/* Form card */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '1.25rem', padding: '1.75rem', marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, marginBottom: '1.25rem' }}>
          ETAPA {step} — {STEPS[step - 1].label}
          {step === 4 && <span style={{ marginLeft: 8, background: C.greenLight, color: C.green, padding: '2px 8px', borderRadius: 999, fontSize: '0.625rem', fontWeight: 700 }}>OPCIONAL</span>}
        </p>
        {step === 1 && <Step1 f={form} set={setField} />}
        {step === 2 && <Step2 f={form} set={setField} />}
        {step === 3 && <Step5 f={form} set={setField} />}
        {step === 4 && <Step6 f={form} set={setField} />}
        {step === 5 && <Step7 f={form} />}
      </div>

      {/* Erros de validação / save */}
      {(validationErrors.length > 0 || saveError) && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'hsl(0 84.2% 55% / 0.08)', border: '1px solid hsl(0 84.2% 55% / 0.25)', fontSize: '0.875rem', color: 'hsl(0 84.2% 40%)' }}>
          {saveError && <p style={{ fontWeight: 500 }}>{saveError}</p>}
          {validationErrors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1) as any)}
          disabled={isFirst}
          style={{ padding: '0.6875rem 1.25rem', borderRadius: '0.625rem', background: 'hsl(var(--muted))', color: isFirst ? C.muted : C.fg, fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: isFirst ? 'not-allowed' : 'pointer', opacity: isFirst ? 0.5 : 1 }}
        >
          ← Anterior
        </button>

        <span style={{ fontSize: '0.75rem', color: C.muted }}>{step} de {STEPS.length}</span>

        {isLast ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '0.6875rem 1.75rem', borderRadius: '0.625rem', background: saving ? 'hsl(168 83% 40%)' : C.green, color: '#fff', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Salvando…' : isEdit ? '✓ Salvar alterações' : '✓ Salvar Equino'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
                {step === 4 && (
              <button type="button" onClick={() => setStep(5)} style={{ padding: '0.6875rem 1rem', borderRadius: '0.625rem', background: 'transparent', color: C.muted, fontWeight: 500, fontSize: '0.875rem', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
                Pular
              </button>
            )}
            <button
              type="button"
              onClick={() => setStep(s => Math.min(5, s + 1))}
              style={{ padding: '0.6875rem 1.5rem', borderRadius: '0.625rem', background: C.green, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
            >
              Próximo →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
