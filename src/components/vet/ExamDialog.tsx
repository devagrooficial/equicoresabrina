import { useEffect, useRef, useState } from 'react';
import { createClient } from '../../lib/supabase';
import { EXAM_LABEL, EXAM_TYPES, type ExamType } from '../../lib/sgq/labels';
import { examValidity, formatBrDate } from '../../lib/examStatus';
import { LAUDO_FILE_TYPES, laudoFileError, todayIso, validateExamForm } from '../../lib/examForm';
import { Banner, Field, VET_BLUE, inputStyle } from './formUI';
import { C, TONE } from './recordUI';

// Lançamento manual de um exame (AIE ou mormo) na ficha do animal, com o laudo
// anexado. Serve para exames feitos fora do portal SGQ ou antes da integração.
// O exame manual é o que não tem código do portal (sgq_code nulo): só esses
// podem ser editados ou excluídos aqui — os do portal a sincronização regrava.

export interface ExamRecord {
  id: string;
  exam_type: ExamType;
  number: string;
  requested_date: string | null;
  collection_date: string | null;
  laboratory: string | null;
  laudo_available: boolean;
  laudo_path: string | null;
  sgq_code: string | null;
}

export const EXAM_COLUMNS = 'id, exam_type, number, requested_date, collection_date, laboratory, laudo_available, laudo_path, sgq_code';

export const isManualExam = (exam: Pick<ExamRecord, 'sgq_code'>) => !exam.sgq_code;

export default function ExamDialog({ equine, exam, onClose, onSaved }: {
  equine: { id: string; vet_id: string; name: string; ownerName: string | null };
  /** Exame manual em edição; ausente = exame novo */
  exam?: ExamRecord | null;
  onClose: () => void;
  onSaved: (exam: ExamRecord, created: boolean) => void;
}) {
  const [examType, setExamType]             = useState<ExamType>(exam?.exam_type ?? 'aieelisa');
  const [number, setNumber]                 = useState(exam?.number ?? '');
  const [collectionDate, setCollectionDate] = useState(exam?.collection_date ?? '');
  const [requestedDate, setRequestedDate]   = useState(exam?.requested_date ?? '');
  const [laboratory, setLaboratory]         = useState(exam?.laboratory ?? '');
  const [file, setFile]                     = useState<File | null>(null);
  const [errors, setErrors]                 = useState<Record<string, string>>({});
  const [error, setError]                   = useState<string | null>(null);
  const [saving, setSaving]                 = useState(false);
  const firstField                          = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [saving, onClose]);

  const validity = examValidity(collectionDate || null);

  function pickFile(picked: File | null) {
    const problem = picked ? laudoFileError(picked) : null;
    setErrors(prev => ({ ...prev, file: problem ?? '' }));
    setFile(problem ? null : picked);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const found = validateExamForm({ number, collectionDate, requestedDate });
    setErrors(found);
    setError(null);
    if (Object.keys(found).length) return;

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Sessão expirada. Faça login novamente.'); setSaving(false); return; }
    if (user.id !== equine.vet_id) { setError('Só o veterinário responsável pelo animal pode lançar exames.'); setSaving(false); return; }

    // Laudo: vai para a pasta do animal, junto com os laudos baixados do portal
    let uploaded: string | null = null;
    if (file) {
      uploaded = `${user.id}/equinos/${equine.id}/laudo-manual-${Date.now()}.${LAUDO_FILE_TYPES[file.type]}`;
      const { error: upErr } = await supabase.storage.from('docs').upload(uploaded, file, { contentType: file.type });
      if (upErr) { setError('Não foi possível enviar o laudo. Tente novamente.'); setSaving(false); return; }
    }

    const payload = {
      exam_type: examType,
      number: number.trim(),
      collection_date: collectionDate,
      requested_date: requestedDate || null,
      laboratory: laboratory.trim() || null,
      ...(uploaded ? { laudo_path: uploaded, laudo_available: true } : {}),
    };
    const result = exam
      ? await supabase.from('vet_equine_exams').update(payload).eq('id', exam.id).select(EXAM_COLUMNS).single()
      : await supabase.from('vet_equine_exams')
          .insert({ ...payload, vet_id: user.id, equine_id: equine.id, animal_name: equine.name, owner_name: equine.ownerName })
          .select(EXAM_COLUMNS).single();

    if (result.error || !result.data) {
      if (uploaded) await supabase.storage.from('docs').remove([uploaded]);   // não deixa arquivo sem exame
      setError(result.error?.code === '23505'
        ? 'Você já tem um exame com este número. Confira o número ou edite o exame que já existe.'
        : 'Não foi possível salvar o exame. Tente novamente.');
      setSaving(false);
      return;
    }

    // Laudo trocado: o arquivo antigo não serve mais
    if (uploaded && exam?.laudo_path && exam.laudo_path !== uploaded) {
      await supabase.storage.from('docs').remove([exam.laudo_path]);
    }
    onSaved(result.data as unknown as ExamRecord, !exam);
  }

  return (
    <div role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}
         style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'hsl(0 0% 0% / 0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="exam-dialog-title" noValidate
            style={{ width: '100%', maxWidth: 540, margin: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 16px 56px hsl(0 0% 0% / 0.35)' }}>
        <h2 id="exam-dialog-title" style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.01em', color: C.fg }}>
          {exam ? 'Editar exame' : 'Adicionar exame'}
        </h2>
        <p style={{ fontSize: '0.8125rem', color: C.muted, marginTop: 2, marginBottom: '1.25rem', overflowWrap: 'anywhere' }}>
          {equine.name}{equine.ownerName ? ` · ${equine.ownerName}` : ''}
        </p>

        {error && <Banner kind="error">{error}</Banner>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Exame" required>
            <select ref={firstField} value={examType} onChange={e => setExamType(e.target.value as ExamType)} style={{ ...inputStyle, appearance: 'auto' }}>
              {EXAM_TYPES.map(type => <option key={type} value={type}>{EXAM_LABEL[type]}</option>)}
            </select>
          </Field>
          <Field label="Nº da requisição ou do laudo" required error={errors.number}>
            <input type="text" value={number} onChange={e => setNumber(e.target.value)} maxLength={60} autoComplete="off" style={inputStyle} />
          </Field>
          <Field label="Data da colheita" required error={errors.collectionDate}>
            <input type="date" value={collectionDate} max={todayIso()} onChange={e => setCollectionDate(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Data da requisição" hint="opcional" error={errors.requestedDate}>
            <input type="date" value={requestedDate} max={todayIso()} onChange={e => setRequestedDate(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Laboratório" hint="opcional" className="sm:col-span-2">
            <input type="text" value={laboratory} onChange={e => setLaboratory(e.target.value)} maxLength={120} style={inputStyle} />
          </Field>
          <Field label="Laudo" hint="PDF, JPG ou PNG, até 15 MB" error={errors.file || undefined} className="sm:col-span-2">
            <input type="file" accept="application/pdf,image/jpeg,image/png"
                   onChange={e => pickFile(e.target.files?.[0] ?? null)}
                   style={{ ...inputStyle, padding: '0.5rem 0.75rem' }} />
            {exam?.laudo_path && !file && (
              <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4 }}>Já existe um laudo anexado. Escolha um arquivo só se quiser trocar.</p>
            )}
          </Field>
        </div>

        {validity && !errors.collectionDate && (
          <p style={{ marginTop: '1rem', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', fontSize: '0.8125rem', background: TONE[validity.state].soft, color: TONE[validity.state].color, fontWeight: 600 }}>
            {validity.state === 'expired' ? 'Venceu em' : 'Válido até'} {formatBrDate(validity.until)}
            <span style={{ fontWeight: 400, color: C.muted }}> · 60 dias após a colheita</span>
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: '1.5rem' }}>
          <button type="button" onClick={onClose} disabled={saving}
                  style={{ padding: '0.5625rem 1.125rem', borderRadius: '0.625rem', background: 'hsl(var(--muted))', color: C.fg, fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rec-btn"
                  style={{ padding: '0.5625rem 1.25rem', borderRadius: '0.625rem', background: saving ? 'hsl(221 83% 65%)' : VET_BLUE, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Salvando…' : exam ? 'Salvar alterações' : 'Salvar exame'}
          </button>
        </div>
      </form>
    </div>
  );
}
