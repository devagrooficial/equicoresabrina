import { useRef, useState, useEffect } from 'react';
import { VET_BLUE } from './formUI';

// Fotos do animal em 4 posições obrigatórias + importação de resenha (PDF/imagem).
// Os arquivos são salvos no bucket "docs" em {vetId}/equinos/{equineId}/.

export const PHOTO_SLOTS = [
  { key: 'lateral-esquerda', label: 'Lateral Esquerda' },
  { key: 'lateral-direita',  label: 'Lateral Direita'  },
  { key: 'frente',           label: 'Frente'           },
  { key: 'verso',            label: 'Verso'            },
] as const;

export type PhotoKey = (typeof PHOTO_SLOTS)[number]['key'];

export interface PhotoSlotState {
  file:         File | null;        // novo arquivo selecionado
  existingUrl:  string | null;      // URL assinada para exibição (modo edição)
  storagePath:  string | null;      // path completo no storage (para deleção)
}

export type PhotosState = Record<PhotoKey, PhotoSlotState>;

export function emptyPhotosState(): PhotosState {
  return {
    'lateral-esquerda': { file: null, existingUrl: null, storagePath: null },
    'lateral-direita':  { file: null, existingUrl: null, storagePath: null },
    'frente':           { file: null, existingUrl: null, storagePath: null },
    'verso':            { file: null, existingUrl: null, storagePath: null },
  };
}

/** Posições ainda sem foto (nem nova, nem existente) */
export function missingPhotos(photos: PhotosState): string[] {
  return PHOTO_SLOTS
    .filter(s => !photos[s.key].file && !photos[s.key].existingUrl)
    .map(s => s.label);
}

// ─── Constantes de validação ───────────────────────────────────────────────────

const PHOTO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const PHOTO_MAX_BYTES     = 10 * 1024 * 1024; // 10 MB

const RESENHA_ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const RESENHA_MAX_BYTES     = 20 * 1024 * 1024; // 20 MB

export function validatePhotoFile(file: File): string | null {
  if (!PHOTO_ALLOWED_TYPES.has(file.type)) {
    return `Formato não suportado (${file.type || 'desconhecido'}). Use JPEG, PNG ou WebP.`;
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 10 MB.`;
  }
  return null;
}

export function validateResenhaFile(file: File): string | null {
  if (!RESENHA_ALLOWED_TYPES.has(file.type)) {
    return `Formato não suportado. Use PDF, JPEG ou PNG.`;
  }
  if (file.size > RESENHA_MAX_BYTES) {
    return `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 20 MB.`;
  }
  return null;
}

function CameraIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>;
}

// ─── Slot de foto ─────────────────────────────────────────────────────────────

function PhotoSlot({ label, state, error: slotError, onSelect, onClear }: {
  label: string;
  state: PhotoSlotState;
  error: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview]       = useState<string | null>(null);
  const [fileError, setFileError]   = useState<string | null>(null);

  useEffect(() => {
    if (state.file) {
      const url = URL.createObjectURL(state.file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(state.existingUrl);
  }, [state.file, state.existingUrl]);

  const hasPhoto = !!preview;

  function handleFileChange(f: File) {
    setFileError(null);
    const err = validatePhotoFile(f);
    if (err) { setFileError(err); return; }
    onSelect(f);
  }

  return (
    <div>
      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: '0.375rem' }}>
        {label} *
      </p>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          position: 'relative', borderRadius: '0.75rem', overflow: 'hidden', cursor: 'pointer',
          aspectRatio: '4 / 3',
          border: `2px dashed ${(slotError || fileError) ? 'hsl(0 84.2% 55%)' : hasPhoto ? 'hsl(var(--border))' : 'hsl(221 83% 53% / 0.4)'}`,
          background: hasPhoto ? '#000' : 'hsl(221 83% 53% / 0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {hasPhoto ? (
          <>
            <img src={preview!} alt={`Foto ${label}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              background: 'linear-gradient(transparent 60%, rgba(0,0,0,0.55))', padding: '0.5rem', gap: 8,
            }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#fff' }}>Trocar foto</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setFileError(null); onClear(); if (inputRef.current) inputRef.current.value = ''; }}
                style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#ffb4b4', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Remover
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: VET_BLUE }}>
            <CameraIcon />
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Enviar foto</span>
          </div>
        )}
      </div>
      {fileError && (
        <p style={{ fontSize: '0.7rem', color: 'hsl(0 84.2% 50%)', marginTop: '0.25rem', fontWeight: 500 }}>
          {fileError}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFileChange(f);
          // Reset para permitir selecionar o mesmo arquivo novamente após erro
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── Grid de fotos ────────────────────────────────────────────────────────────

export function EquinePhotosGrid({ photos, errorKeys, onChange }: {
  photos: PhotosState;
  errorKeys: PhotoKey[];
  onChange: (key: PhotoKey, slot: PhotoSlotState) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {PHOTO_SLOTS.map(s => (
        <PhotoSlot
          key={s.key}
          label={s.label}
          state={photos[s.key]}
          error={errorKeys.includes(s.key)}
          onSelect={file => onChange(s.key, { ...photos[s.key], file })}
          onClear={() => onChange(s.key, { file: null, existingUrl: null, storagePath: null })}
        />
      ))}
    </div>
  );
}

// ─── Upload de resenha externa (PDF/imagem) ───────────────────────────────────

export function ResenhaFileUpload({ file, existingUrl, onSelect, onClear, onError }: {
  file: File | null;
  existingUrl: string | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  onError?: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const current = file?.name ?? (existingUrl ? decodeURIComponent(existingUrl.split('/').pop() ?? 'arquivo') : null);

  function handleFileChange(f: File) {
    const err = validateResenhaFile(f);
    if (err) { onError?.(err); return; }
    onSelect(f);
  }

  return (
    <div style={{
      borderRadius: '0.75rem', border: '1px solid hsl(var(--border))',
      background: 'hsl(var(--muted) / 0.3)', padding: '1rem',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'hsl(221 83% 53% / 0.1)', color: VET_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
          Importar resenha pronta (PDF ou imagem)
        </p>
        <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
          {current
            ? <>Arquivo: <strong style={{ color: 'hsl(var(--foreground))' }}>{current}</strong></>
            : 'Se a resenha já foi feita em outro sistema, envie o arquivo em vez de desenhar.'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {current && (
          <button type="button" onClick={() => { onClear(); if (inputRef.current) inputRef.current.value = ''; }}
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', background: 'hsl(0 84.2% 55% / 0.08)', color: 'hsl(0 84.2% 50%)', fontWeight: 600, fontSize: '0.8125rem', border: 'none', cursor: 'pointer' }}>
            Remover
          </button>
        )}
        <button type="button" onClick={() => inputRef.current?.click()}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', background: VET_BLUE, color: '#fff', fontWeight: 600, fontSize: '0.8125rem', border: 'none', cursor: 'pointer' }}>
          {current ? 'Trocar arquivo' : 'Selecionar arquivo'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFileChange(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
