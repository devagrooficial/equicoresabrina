import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { createClient, isValidUUID, resolveDocUrl } from '../../lib/supabase';
import { onlyDigits, maskCpfCnpj, ageFromBirthDate } from '../../lib/br';
import { ESPECIES, RACAS, PELAGENS, SEXOS } from '../../lib/vetCatalogs';
import { Field, Banner, SubmitButton, FormCard, inputStyle, VET_BLUE } from './formUI';
import ResenhaCanvas, { type ResenhaCanvasHandle } from './ResenhaCanvas';
import {
  EquinePhotosGrid, ResenhaFileUpload, PHOTO_SLOTS, emptyPhotosState, missingPhotos,
  validateResenhaFile,
  type PhotosState, type PhotoKey, type PhotoSlotState,
} from './EquinePhotos';

const schema = z.object({
  name:      z.string().min(2, 'Informe o nome do animal'),
  owner_id:  z.string().min(1, 'Associe o animal a um proprietário'),
  age_years: z.string().refine(v => v === '' || (/^\d+$/.test(v) && parseInt(v, 10) <= 60), 'Idade inválida'),
});

interface OwnerOption    { id: string; name: string; cpf_cnpj: string; }
interface PropertyOption { id: string; name: string; }

interface Props {
  editId?: string | null;
}

export default function EquinoVetForm({ editId = null }: Props) {
  const [owners, setOwners]         = useState<OwnerOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [vetId, setVetId]           = useState<string | null>(null);

  const [name, setName]                     = useState('');
  const [ownerId, setOwnerId]               = useState('');
  const [propertyId, setPropertyId]         = useState('');
  const [registryBrand, setRegistryBrand]   = useState('');
  const [chip, setChip]                     = useState('');
  const [species, setSpecies]               = useState('');
  const [breed, setBreed]                   = useState('');
  const [coat, setCoat]                     = useState('');
  const [sex, setSex]                       = useState('');
  const [birthDate, setBirthDate]           = useState('');
  const [ageYears, setAgeYears]             = useState('');
  const [signsDesc, setSignsDesc]           = useState('');

  // resenha_url armazenado no DB (path ou URL legada) — usado para submit
  const [savedResenha, setSavedResenha]         = useState<string | null>(null);
  // URL resolvida (assinada) passada ao canvas para exibição
  const [savedResenhaDisplayUrl, setSavedResenhaDisplayUrl] = useState<string | null>(null);

  const [photos, setPhotos]                 = useState<PhotosState>(emptyPhotosState());
  const [photoErrorKeys, setPhotoErrorKeys] = useState<PhotoKey[]>([]);
  const [resenhaFile, setResenhaFile]       = useState<File | null>(null);
  const [resenhaFileExisting, setResenhaFileExisting] = useState<string | null>(null);

  const [cpfSearch, setCpfSearch] = useState('');
  const [cpfMsg, setCpfMsg]       = useState<{ kind: 'ok' | 'info' | 'none'; text: string } | null>(null);

  const [loading, setLoading]               = useState(false);
  const [loadingRecord, setLoadingRecord]   = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [success, setSuccess]               = useState(false);
  const [fieldErrors, setFieldErrors]       = useState<Record<string, string>>({});

  const supabase   = createClient();
  const resenhaRef = useRef<ResenhaCanvasHandle>(null);

  // Valida editId antes de qualquer query
  const safeEditId = editId && isValidUUID(editId) ? editId : null;

  useEffect(() => {
    (async () => {
      // Obtém o usuário atual (sempre via getUser para evitar trust em cookie)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setVetId(user.id);

      const [{ data: ownerRows }, { data: propRows }] = await Promise.all([
        supabase.from('vet_owners').select('id, name, cpf_cnpj').order('name'),
        supabase.from('vet_properties').select('id, name').order('name'),
      ]);
      setOwners(ownerRows ?? []);
      setProperties(propRows ?? []);

      if (safeEditId && user) {
        const { data, error: err } = await supabase
          .from('vet_equines')
          .select('*')
          .eq('id', safeEditId)
          .maybeSingle();

        if (err || !data) {
          setError('Registro não encontrado ou sem permissão de acesso.');
        } else {
          setName(data.name ?? '');
          setOwnerId(data.owner_id ?? '');
          setPropertyId(data.property_id ?? '');
          setRegistryBrand(data.registry_brand ?? '');
          setChip(data.chip ?? '');
          setSpecies(data.species ?? '');
          setBreed(data.breed ?? '');
          setCoat(data.coat ?? '');
          setSex(data.sex ?? '');
          setBirthDate(data.birth_date ?? '');
          setAgeYears(data.age_years != null ? String(data.age_years) : '');
          setSignsDesc(data.signs_desc ?? '');

          if (data.resenha_url) {
            setSavedResenha(data.resenha_url);
            // Resolve URL assinada para exibição no canvas
            resolveDocUrl(data.resenha_url).then(url => setSavedResenhaDisplayUrl(url));
          }

          // Lista arquivos existentes — tenta novo path ({uid}/equinos/{id}) e legado
          const [newFolder, legacyFolder] = await Promise.all([
            supabase.storage.from('docs').list(`${user.id}/equinos/${safeEditId}`, { limit: 100 }),
            supabase.storage.from('docs').list(`equinos/${safeEditId}`, { limit: 100 }),
          ]);

          const resolveSlotFiles = async () => {
            const next = emptyPhotosState();

            // Novo formato tem prioridade sobre legado
            const newFiles    = newFolder.data ?? [];
            const legacyFiles = legacyFolder.data ?? [];

            for (const slot of PHOTO_SLOTS) {
              // Busca no novo path
              const newFile = newFiles.find(x => x.name.startsWith(`foto-${slot.key}`));
              if (newFile) {
                const fullPath  = `${user.id}/equinos/${safeEditId}/${newFile.name}`;
                const signedUrl = await resolveDocUrl(fullPath);
                next[slot.key]  = { file: null, existingUrl: signedUrl, storagePath: fullPath };
                continue;
              }
              // Fallback: legado
              const legacyFile = legacyFiles.find(x => x.name.startsWith(`foto-${slot.key}`));
              if (legacyFile) {
                const fullPath  = `equinos/${safeEditId}/${legacyFile.name}`;
                const signedUrl = await resolveDocUrl(fullPath);
                next[slot.key]  = { file: null, existingUrl: signedUrl, storagePath: fullPath };
              }
            }
            setPhotos(next);

            // Resenha importada existente
            const rf = newFiles.find(x => x.name.startsWith('resenha-importada'))
                    ?? legacyFiles.find(x => x.name.startsWith('resenha-importada'));
            if (rf) {
              const prefix   = newFiles.find(x => x.name === rf.name)
                ? `${user.id}/equinos/${safeEditId}`
                : `equinos/${safeEditId}`;
              const fullPath = `${prefix}/${rf.name}`;
              const signedUrl = await resolveDocUrl(fullPath);
              setResenhaFileExisting(signedUrl);
            }
          };

          await resolveSlotFiles();
        }
      }
      setLoadingRecord(false);
    })();
  }, [safeEditId]);

  function handleBirthDate(value: string) {
    setBirthDate(value);
    const age = ageFromBirthDate(value);
    if (age != null) setAgeYears(String(age));
  }

  async function searchOwnerByCpf() {
    const digits = onlyDigits(cpfSearch);
    if (digits.length < 11) {
      setCpfMsg({ kind: 'none', text: 'Digite um CPF (11 dígitos) ou CNPJ (14 dígitos) completo.' });
      return;
    }

    const mine = owners.find(o => o.cpf_cnpj === digits);
    if (mine) {
      setOwnerId(mine.id);
      setCpfMsg({ kind: 'ok', text: `Proprietário associado: ${mine.name}` });
      return;
    }

    const { data } = await supabase.rpc('lookup_owner_by_cpf', { p_cpf: digits });
    if (data && data.length > 0) {
      setCpfMsg({
        kind: 'info',
        text: `Encontrado no cadastro geral: ${data[0].name}. Cadastre-o como seu proprietário para associar.`,
      });
    } else {
      setCpfMsg({ kind: 'none', text: 'CPF não encontrado. Cadastre o proprietário primeiro.' });
    }
  }

  /**
   * Envia um arquivo para docs/{vetId}/equinos/{equineId}/{baseName}-{ts}.{ext}.
   * Remove versões anteriores do mesmo prefixo antes de enviar.
   * Retorna o storage path (não a URL pública).
   */
  async function uploadEquineFile(
    currentVetId: string,
    equineId: string,
    baseName: string,
    body: File | Blob,
    contentType: string,
    ext: string,
    existingPaths: string[],  // paths completos já existentes no storage
  ): Promise<string> {
    // Remove arquivos anteriores do mesmo slot (novo e legado)
    const toDelete = existingPaths.filter(p =>
      p.endsWith(`/${baseName}`) || p.includes(`/${baseName}-`)
    );
    if (toDelete.length) await supabase.storage.from('docs').remove(toDelete);

    const path = `${currentVetId}/equinos/${equineId}/${baseName}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('docs').upload(path, body, { contentType });
    if (upErr) throw new Error('Falha ao enviar arquivo. Tente novamente.');
    return path;
  }

  function fileExt(f: File, fallback: string): string {
    const ext = f.name.includes('.') ? f.name.split('.').pop()!.toLowerCase() : '';
    return ext || fallback;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setFieldErrors({});
    setPhotoErrorKeys([]);

    const result = schema.safeParse({ name, owner_id: ownerId, age_years: ageYears });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach(i => { if (i.path[0]) errs[String(i.path[0])] = i.message; });
      setFieldErrors(errs);
      return;
    }

    const missing = missingPhotos(photos);
    if (missing.length > 0) {
      setPhotoErrorKeys(PHOTO_SLOTS.filter(s => !photos[s.key].file && !photos[s.key].existingUrl).map(s => s.key));
      setError(`Envie as fotos obrigatórias do animal: ${missing.join(', ')}.`);
      return;
    }

    const hasDrawnResenha    = resenhaRef.current?.isDirty() || !!savedResenha;
    const hasUploadedResenha = !!resenhaFile || !!resenhaFileExisting;
    if (!hasDrawnResenha && !hasUploadedResenha) {
      setError('Resenha obrigatória: desenhe no diagrama OU importe um arquivo de resenha existente.');
      return;
    }

    // Valida o arquivo de resenha se houver novo selecionado
    if (resenhaFile) {
      const resenhaErr = validateResenhaFile(resenhaFile);
      if (resenhaErr) { setError(resenhaErr); return; }
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Sessão expirada. Faça login novamente.');
      setLoading(false);
      return;
    }

    const currentVetId = user.id;
    const equineId     = safeEditId ?? crypto.randomUUID();
    const uploadedPaths: string[] = [];

    try {
      // Coleta todos os paths existentes (para remoção ao substituir)
      const allExistingPaths = PHOTO_SLOTS.flatMap(s =>
        photos[s.key].storagePath ? [photos[s.key].storagePath!] : []
      );

      // Fotos novas
      for (const slot of PHOTO_SLOTS) {
        const f = photos[slot.key].file;
        if (f) {
          const path = await uploadEquineFile(
            currentVetId, equineId, `foto-${slot.key}`, f,
            f.type || 'image/jpeg', fileExt(f, 'jpg'), allExistingPaths,
          );
          uploadedPaths.push(path);
        }
      }

      // Resenha: arquivo importado > desenho novo > manter salva
      let resenhaPath = savedResenha; // path ou URL legada
      if (resenhaFile) {
        resenhaPath = await uploadEquineFile(
          currentVetId, equineId, 'resenha-importada', resenhaFile,
          resenhaFile.type || 'application/pdf', fileExt(resenhaFile, 'pdf'), allExistingPaths,
        );
        uploadedPaths.push(resenhaPath);
      } else if (resenhaRef.current?.isDirty()) {
        const blob = await resenhaRef.current.exportBlob();
        if (blob) {
          resenhaPath = await uploadEquineFile(
            currentVetId, equineId, 'resenha-desenhada', blob,
            'image/png', 'png', allExistingPaths,
          );
          uploadedPaths.push(resenhaPath);
        }
      }

      const payload = {
        id:             equineId,
        vet_id:         currentVetId,
        owner_id:       ownerId,
        property_id:    propertyId || null,
        name:           name.trim(),
        registry_brand: registryBrand.trim() || null,
        chip:           chip.trim() || null,
        species:        species || null,
        breed:          breed || null,
        coat:           coat || null,
        sex:            sex || null,
        birth_date:     birthDate || null,
        age_years:      ageYears === '' ? null : parseInt(ageYears, 10),
        signs_desc:     signsDesc.trim() || null,
        resenha_url:    resenhaPath,
      };

      const { error: dbErr } = safeEditId
        ? await supabase.from('vet_equines').update(payload).eq('id', safeEditId)
        : await supabase.from('vet_equines').insert(payload);

      if (dbErr) throw new Error(dbErr.message);

      window.location.href = '/vet/registros?tab=equinos';
    } catch (err: unknown) {
      // Novo registro que falhou: remove arquivos órfãos
      if (!safeEditId && uploadedPaths.length > 0) {
        await supabase.storage.from('docs').remove(uploadedPaths);
      }
      console.error('[EquinoVetForm] erro ao salvar:', err);
      setError('Não foi possível salvar o cadastro. Verifique sua conexão e tente novamente.');
      setLoading(false);
    }
  }

  if (loadingRecord) {
    return (
      <FormCard title="Cadastro do Animal">
        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>Carregando…</p>
      </FormCard>
    );
  }

  const cpfMsgColor = cpfMsg?.kind === 'ok'
    ? 'hsl(142 71% 32%)'
    : cpfMsg?.kind === 'info' ? VET_BLUE : 'hsl(25 95% 40%)';

  return (
    <FormCard
      title={safeEditId ? 'Editar Animal' : 'Cadastro do Animal'}
      subtitle="O animal é sempre associado a um proprietário (via CPF). A propriedade é opcional."
    >
      {error && <Banner kind="error">{error}</Banner>}
      {success && <Banner kind="success">Animal cadastrado com sucesso!</Banner>}

      {owners.length === 0 && (
        <Banner kind="error">
          Você ainda não tem proprietários cadastrados.{' '}
          <a href="/vet/cadastros/proprietario" style={{ color: 'inherit', fontWeight: 700 }}>Cadastre um proprietário primeiro →</a>
        </Banner>
      )}

      {/* Busca de proprietário por CPF */}
      <div style={{
        marginBottom: '1.5rem', padding: '1rem', borderRadius: '0.75rem',
        background: 'hsl(221 83% 53% / 0.05)', border: '1px solid hsl(221 83% 53% / 0.15)',
      }}>
        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: '0.375rem' }}>
          Buscar proprietário por CPF/CNPJ
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            inputMode="numeric"
            value={cpfSearch}
            onChange={e => setCpfSearch(maskCpfCnpj(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchOwnerByCpf(); } }}
            placeholder="000.000.000-00"
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <button type="button" onClick={searchOwnerByCpf}
                  style={{ padding: '0.625rem 1.25rem', borderRadius: '0.625rem', background: VET_BLUE, color: '#fff', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}>
            Buscar
          </button>
        </div>
        {cpfMsg && (
          <p style={{ fontSize: '0.8125rem', color: cpfMsgColor, marginTop: '0.5rem', fontWeight: 500 }}>
            {cpfMsg.text}
            {cpfMsg.kind !== 'ok' && (
              <>{' '}<a href={`/vet/cadastros/proprietario?cpf=${onlyDigits(cpfSearch)}`} style={{ color: VET_BLUE, fontWeight: 700 }}>Cadastrar proprietário</a></>
            )}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <Field label="Nome do Animal" required error={fieldErrors.name} className="md:col-span-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Proprietário" required error={fieldErrors.owner_id} className="md:col-span-4">
            <select value={ownerId} onChange={e => setOwnerId(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="">Selecione</option>
              {owners.map(o => (
                <option key={o.id} value={o.id}>{o.name} — {maskCpfCnpj(o.cpf_cnpj)}</option>
              ))}
            </select>
          </Field>

          <Field label="Registro/Marca" className="md:col-span-2">
            <input type="text" value={registryBrand} onChange={e => setRegistryBrand(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Nº. Chip" className="md:col-span-2">
            <input type="text" value={chip} onChange={e => setChip(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Propriedade" hint="opcional" className="md:col-span-4">
            <select value={propertyId} onChange={e => setPropertyId(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="">Nenhuma / outra propriedade</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          <Field label="Espécie" className="md:col-span-2">
            <select value={species} onChange={e => setSpecies(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="">Selecione</option>
              {ESPECIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Raça" className="md:col-span-2">
            <select value={breed} onChange={e => setBreed(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="">Selecione</option>
              {RACAS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>

          <Field label="Pelagem" className="md:col-span-2">
            <select value={coat} onChange={e => setCoat(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="">Selecione</option>
              {PELAGENS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>

          <Field label="Sexo" className="md:col-span-2">
            <select value={sex} onChange={e => setSex(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="">Selecione</option>
              {SEXOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Data de Nascimento" className="md:col-span-2">
            <input type="date" value={birthDate} onChange={e => handleBirthDate(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Idade" hint="anos" error={fieldErrors.age_years} className="md:col-span-2">
            <input type="number" min="0" max="60" value={ageYears} onChange={e => setAgeYears(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Descrição de Sinais" className="md:col-span-12">
            <textarea
              value={signsDesc}
              onChange={e => setSignsDesc(e.target.value)}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 110 }}
            />
          </Field>
        </div>

        {/* Resenha gráfica */}
        <div style={{ marginTop: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: '0.25rem' }}>
            Resenha Gráfica *
          </label>
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
            Obrigatório: desenhe no diagrama abaixo <strong>ou</strong> importe o arquivo no final da página.
          </p>
          <ResenhaCanvas ref={resenhaRef} savedUrl={savedResenhaDisplayUrl} />
        </div>

        {/* Fotos do animal — 4 posições obrigatórias */}
        <div style={{ marginTop: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: '0.25rem' }}>
            Fotos do Animal *
          </label>
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.75rem' }}>
            Envie as 4 fotos: lateral esquerda, lateral direita, frente e verso. Máximo 10 MB por foto (JPEG, PNG ou WebP).
          </p>
          <EquinePhotosGrid
            photos={photos}
            errorKeys={photoErrorKeys}
            onChange={(key: PhotoKey, slot: PhotoSlotState) => {
              setPhotos(prev => ({ ...prev, [key]: slot }));
              setPhotoErrorKeys(prev => prev.filter(k => k !== key));
            }}
          />
        </div>

        {/* Importação de resenha pronta */}
        <div style={{ marginTop: '2rem' }}>
          <ResenhaFileUpload
            file={resenhaFile}
            existingUrl={resenhaFileExisting}
            onSelect={f => setResenhaFile(f)}
            onClear={() => { setResenhaFile(null); setResenhaFileExisting(null); }}
            onError={msg => setError(msg)}
          />
        </div>

        <SubmitButton loading={loading} />
      </form>
    </FormCard>
  );
}
