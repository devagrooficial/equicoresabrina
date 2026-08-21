import { useState, useEffect, useRef, useCallback } from 'react';

// Modal de zoom para imagens — scroll para ampliar (1x–4x) e arraste para
// posicionar quando ampliada. Usado no ambiente do veterinário para
// examinar detalhes de fotos/resenhas/marca de fogo.

export function useLightbox() {
  const [src, setSrc] = useState<string | null>(null);
  return { src, open: setSrc, close: () => setSrc(null) };
}

function ZoomIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><line x1="11" x2="11" y1="8" y2="14" /><line x1="8" x2="14" y1="11" y2="11" />
    </svg>
  );
}

/** Botão de lupa sobreposto a uma miniatura — abre o Lightbox sem disparar o clique do elemento pai. */
export function ZoomButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      title="Ampliar imagem"
      style={{
        position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%',
        background: 'hsl(0 0% 0% / 0.55)', color: '#fff', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
      }}
    >
      <ZoomIcon />
    </button>
  );
}

export function Lightbox({ src, alt, onClose }: { src: string | null; alt?: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!src) return;
    setScale(1);
    setPos({ x: 0, y: 0 });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prevOverflow; window.removeEventListener('keydown', onKey); };
  }, [src, onClose]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(4, Math.max(1, s + (e.deltaY < 0 ? 0.25 : -0.25))));
  }, []);

  if (!src) return null;

  return (
    <div
      onClick={onClose}
      onWheel={handleWheel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'hsl(0 0% 0% / 0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
        touchAction: 'none',
      }}
    >
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onClose(); }}
        style={{
          position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%',
          background: 'hsl(0 0% 100% / 0.12)', color: '#fff', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </button>

      <span style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', fontSize: '0.75rem', color: 'hsl(0 0% 100% / 0.6)' }}>
        Role o mouse para ampliar {scale > 1 ? '· arraste para mover' : ''}
      </span>

      <img
        src={src}
        alt={alt ?? 'Imagem ampliada'}
        draggable={false}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => {
          if (scale <= 1) return;
          dragging.current = true;
          last.current = { x: e.clientX, y: e.clientY };
        }}
        onMouseMove={e => {
          if (!dragging.current) return;
          const dx = e.clientX - last.current.x;
          const dy = e.clientY - last.current.y;
          last.current = { x: e.clientX, y: e.clientY };
          setPos(p => ({ x: p.x + dx, y: p.y + dy }));
        }}
        onMouseUp={() => { dragging.current = false; }}
        onMouseLeave={() => { dragging.current = false; }}
        style={{
          maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain',
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transition: dragging.current ? 'none' : 'transform 0.12s ease-out',
          cursor: scale > 1 ? 'grab' : 'default',
          userSelect: 'none',
        }}
      />
    </div>
  );
}
