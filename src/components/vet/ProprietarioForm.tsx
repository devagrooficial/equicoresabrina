import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { createClient, isValidUUID } from '../../lib/supabase';
import { onlyDigits, isValidCpfCnpj, maskCpfCnpj, maskPhone, maskCEP } from '../../lib/br';
import { Field, Banner, SubmitButton, FormCard, UfSelect, CidadeSelect, inputStyle, VET_BLUE } from './formUI';

const schema = z.object({
  name: z.string().min(3, 'Informe o nome completo'),
  cpf_cnpj: z.string().refine(isValidCpfCnpj, 'CPF/CNPJ inválido'),
  email: z.string().email('E-mail inválido').or(z.literal('')),
});

interface Props {
  editId?: string | null;
  /** CPF vindo da busca no cadastro de equino (?cpf=) */
  initialCpf?: string | null;
}

export default function ProprietarioForm({ editId = null, initialCpf = null }: Props) {
  const [name, setName]               = useState('');
  const [cpfCnpj, setCpfCnpj]         = useState(initialCpf ? maskCpfCnpj(initialCpf) : '');
  const [phone, setPhone]             = useState('');
  const [email, setEmail]             = useState('');
  const [address, setAddress]         = useState('');
  const [district, setDistrict]       = useState('');
  const [cep, setCep]                 = useState('');
  const [uf, setUf]                   = useState('');
  const [city, setCity]               = useState('');
  const [producerNum, setProducerNum] = useState('');
  const [loading, setLoading]         = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(!!editId);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);
  const [lookupMsg, setLookupMsg]     = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const supabase = createClient();
  const lookupDone = useRef(false);

  const safeEditId = editId && isValidUUID(editId) ? editId : null;

  useEffect(() => {
    if (!safeEditId) return;
    (async () => {
      const { data, error: err } = await supabase
        .from('vet_owners')
        .select('*')
        .eq('id', safeEditId)
        .maybeSingle();
      if (err || !data) {
        setError('Proprietário não encontrado.');
      } else {
        setName(data.name ?? '');
        setCpfCnpj(maskCpfCnpj(data.cpf_cnpj ?? ''));
        setPhone(data.phone ?? '');
        setEmail(data.email ?? '');
        setAddress(data.address ?? '');
        setDistrict(data.district ?? '');
        setCep(data.cep ?? '');
        setUf(data.uf ?? '');
        setCity(data.city ?? '');
        setProducerNum(data.producer_number ?? '');
      }
      setLoadingRecord(false);
    })();
  }, [editId]);

  // Busca no cadastro geral via CPF/CNPJ e pré-preenche campos vazios
  async function lookupByCpf(value: string) {
    const digits = onlyDigits(value);
    if (digits.length < 11 || editId) return;
    setLookupMsg(null);

    const { data, error: err } = await supabase.rpc('lookup_owner_by_cpf', { p_cpf: digits });
    if (err || !data || data.length === 0) return;

    const found = data[0];
    setName(prev => prev || found.name || '');
    setPhone(prev => prev || (found.phone ? maskPhone(found.phone) : ''));
    setEmail(prev => prev || found.email || '');
    setAddress(prev => prev || found.address || '');
    setDistrict(prev => prev || found.district || '');
    setCep(prev => prev || (found.cep ? maskCEP(found.cep) : ''));
    setUf(prev => prev || found.uf || '');
    setCity(prev => prev || found.city || '');
    setProducerNum(prev => prev || found.producer_number || '');
    setLookupMsg(found.source === 'usuario'
      ? 'Dados encontrados no cadastro geral (usuário do EquiCore). Complete o que faltar.'
      : 'Dados encontrados no cadastro geral. Complete o que faltar.');
  }

  // Lookup automático quando chega com ?cpf= preenchido
  useEffect(() => {
    if (initialCpf && !lookupDone.current) {
      lookupDone.current = true;
      lookupByCpf(initialCpf);
    }
  }, [initialCpf]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setFieldErrors({});

    const result = schema.safeParse({ name, cpf_cnpj: cpfCnpj, email });
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
      vet_id:          user.id,
      name:            name.trim(),
      cpf_cnpj:        onlyDigits(cpfCnpj),
      phone:           phone.trim() || null,
      email:           email.trim() || null,
      address:         address.trim() || null,
      district:        district.trim() || null,
      cep:             cep.trim() || null,
      uf:              uf || null,
      city:            city || null,
      producer_number: producerNum.trim() || null,
    };

    const { error: err } = safeEditId
      ? await supabase.from('vet_owners').update(payload).eq('id', safeEditId)
      : await supabase.from('vet_owners').insert(payload);

    setLoading(false);

    if (err) {
      if (err.code === '23505') {
        setError('Você já possui um proprietário cadastrado com este CPF/CNPJ.');
      } else {
        console.error('[ProprietarioForm] erro ao salvar:', err);
        setError('Não foi possível salvar o cadastro. Verifique sua conexão e tente novamente.');
      }
      return;
    }

    if (safeEditId) {
      window.location.href = '/vet/registros?tab=proprietarios';
    } else {
      setSuccess(true);
      setName(''); setCpfCnpj(''); setPhone(''); setEmail(''); setAddress('');
      setDistrict(''); setCep(''); setUf(''); setCity(''); setProducerNum('');
      setLookupMsg(null);
    }
  }

  if (loadingRecord) {
    return <FormCard title="Cadastro de Proprietário"><p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>Carregando…</p></FormCard>;
  }

  return (
    <FormCard title={safeEditId ? 'Editar Proprietário' : 'Cadastro de Proprietário'}>
      {error && <Banner kind="error">{error}</Banner>}
      {success && (
        <Banner kind="success">
          Proprietário cadastrado com sucesso!{' '}
          <a href="/vet/cadastros/equino" style={{ color: 'inherit', fontWeight: 700 }}>Cadastrar equino →</a>
        </Banner>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Field label="Nome" required error={fieldErrors.name} className="md:col-span-3">
            <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="CPF/CNPJ" required hint="Somente números" error={fieldErrors.cpf_cnpj} className="md:col-span-2">
            <input
              type="text"
              inputMode="numeric"
              value={cpfCnpj}
              onChange={e => setCpfCnpj(maskCpfCnpj(e.target.value))}
              onBlur={e => lookupByCpf(e.target.value)}
              placeholder="000.000.000-00"
              style={inputStyle}
            />
            {lookupMsg && <p style={{ fontSize: '0.75rem', color: VET_BLUE, marginTop: '0.25rem' }}>{lookupMsg}</p>}
          </Field>

          <Field label="Telefone" className="md:col-span-1">
            <input type="tel" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} placeholder="(65) 99999-9999" style={inputStyle} />
          </Field>

          <Field label="E-mail" error={fieldErrors.email} className="md:col-span-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" style={inputStyle} />
          </Field>

          <Field label="Endereço" className="md:col-span-3">
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Bairro" className="md:col-span-1">
            <input type="text" value={district} onChange={e => setDistrict(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="CEP" className="md:col-span-1">
            <input type="text" inputMode="numeric" value={cep} onChange={e => setCep(maskCEP(e.target.value))} placeholder="78000-000" style={inputStyle} />
          </Field>

          <Field label="UF" className="md:col-span-1">
            <UfSelect value={uf} onChange={u => { setUf(u); setCity(''); }} />
          </Field>

          <Field label="Cidade" className="md:col-span-2">
            <CidadeSelect uf={uf} value={city} onChange={setCity} />
          </Field>

          <Field label="Nº do Produtor" className="md:col-span-2">
            <input type="text" value={producerNum} onChange={e => setProducerNum(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <SubmitButton loading={loading} />
      </form>
    </FormCard>
  );
}
