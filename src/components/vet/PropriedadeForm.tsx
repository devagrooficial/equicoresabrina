import { useState, useEffect } from 'react';
import { z } from 'zod';
import { createClient, isValidUUID } from '../../lib/supabase';
import { CLASSIFICACOES } from '../../lib/vetCatalogs';
import { Field, Banner, SubmitButton, FormCard, UfSelect, CidadeSelect, inputStyle } from './formUI';

const schema = z.object({
  name: z.string().min(2, 'Informe o nome da propriedade'),
  animal_count: z.string().refine(v => v === '' || (/^\d+$/.test(v) && parseInt(v, 10) >= 0), 'Quantidade inválida'),
});

interface Props {
  /** id para edição; null para novo cadastro */
  editId?: string | null;
}

export default function PropriedadeForm({ editId = null }: Props) {
  const safeEditId = editId && isValidUUID(editId) ? editId : null;
  const [name, setName]                     = useState('');
  const [address, setAddress]               = useState('');
  const [oesaCode, setOesaCode]             = useState('');
  const [uf, setUf]                         = useState('');
  const [city, setCity]                     = useState('');
  const [classification, setClassification] = useState('');
  const [animalCount, setAnimalCount]       = useState('');
  const [loading, setLoading]               = useState(false);
  const [loadingRecord, setLoadingRecord]   = useState(!!safeEditId);
  const [error, setError]                   = useState<string | null>(null);
  const [success, setSuccess]               = useState(false);
  const [fieldErrors, setFieldErrors]       = useState<Record<string, string>>({});

  const supabase = createClient();

  useEffect(() => {
    if (!safeEditId) return;
    (async () => {
      const { data, error: err } = await supabase
        .from('vet_properties')
        .select('*')
        .eq('id', safeEditId)
        .maybeSingle();
      if (err || !data) {
        setError('Propriedade não encontrada.');
      } else {
        setName(data.name ?? '');
        setAddress(data.address ?? '');
        setOesaCode(data.oesa_code ?? '');
        setUf(data.uf ?? '');
        setCity(data.city ?? '');
        setClassification(data.classification ?? '');
        setAnimalCount(data.animal_count != null ? String(data.animal_count) : '');
      }
      setLoadingRecord(false);
    })();
  }, [editId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setFieldErrors({});

    const result = schema.safeParse({ name, animal_count: animalCount });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach(i => { if (i.path[0]) errs[String(i.path[0])] = i.message; });
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Sessão expirada — faça login novamente.'); setLoading(false); return; }

    const payload = {
      vet_id:         user.id,
      name:           name.trim(),
      address:        address.trim() || null,
      oesa_code:      oesaCode.trim() || null,
      uf:             uf || null,
      city:           city || null,
      classification: classification || null,
      animal_count:   animalCount === '' ? null : parseInt(animalCount, 10),
    };

    const { error: err } = safeEditId
      ? await supabase.from('vet_properties').update(payload).eq('id', safeEditId)
      : await supabase.from('vet_properties').insert(payload);

    setLoading(false);

    if (err) {
      console.error('[PropriedadeForm] erro ao salvar:', err);
      setError('Não foi possível salvar o cadastro. Verifique sua conexão e tente novamente.');
      return;
    }

    if (safeEditId) {
      window.location.href = '/vet/registros?tab=propriedades';
    } else {
      setSuccess(true);
      setName(''); setAddress(''); setOesaCode(''); setUf(''); setCity('');
      setClassification(''); setAnimalCount('');
    }
  }

  if (loadingRecord) {
    return <FormCard title="Cadastro da Propriedade"><p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>Carregando…</p></FormCard>;
  }

  return (
    <FormCard title={safeEditId ? 'Editar Propriedade' : 'Cadastro da Propriedade'}>
      {error && <Banner kind="error">{error}</Banner>}
      {success && <Banner kind="success">Propriedade cadastrada com sucesso! <a href="/vet/registros?tab=propriedades" style={{ color: 'inherit', fontWeight: 700 }}>Ver registros →</a></Banner>}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Field label="Nome da Propriedade" required error={fieldErrors.name} className="md:col-span-2">
            <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Endereço ou Coordenadas" className="md:col-span-3">
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Nº Cadastro OESA" className="md:col-span-1">
            <input type="text" value={oesaCode} onChange={e => setOesaCode(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="UF" className="md:col-span-1">
            <UfSelect value={uf} onChange={u => { setUf(u); setCity(''); }} />
          </Field>

          <Field label="Cidade" className="md:col-span-2">
            <CidadeSelect uf={uf} value={city} onChange={setCity} />
          </Field>

          <Field label="Classificação" className="md:col-span-2">
            <select value={classification} onChange={e => setClassification(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="">Selecione</option>
              {CLASSIFICACOES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Quantidade de Animais" error={fieldErrors.animal_count} className="md:col-span-1">
            <input type="number" min="0" value={animalCount} onChange={e => setAnimalCount(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <SubmitButton loading={loading} />
      </form>
    </FormCard>
  );
}
