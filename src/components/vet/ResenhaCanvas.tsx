import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';

// Canvas de resenha gráfica: desenho à mão livre sobre o diagrama do equino.
// Exporta PNG composto (diagrama + anotações) via exportBlob().

const W = 1993;
const H = 1353;
const MAX_HISTORY = 25;

export interface ResenhaCanvasHandle {
  exportBlob(): Promise<Blob | null>;
  isDirty(): boolean;
}

interface Props {
  /** URL de uma resenha já salva (PNG composto) para edição */
  savedUrl?: string | null;
}

type Tool = 'pencil' | 'eraser' | 'line';

const SIZES  = [2, 4, 7, 12];
const COLORS = ['#1a1a1a', '#d32f2f', '#1565c0'];

const btnStyle = (active: boolean): React.CSSProperties => ({
  width: 34,
  height: 34,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  border: `1px solid ${active ? 'hsl(221 83% 53%)' : 'hsl(var(--border))'}`,
  background: active ? 'hsl(221 83% 53% / 0.12)' : 'hsl(var(--card))',
  color: active ? 'hsl(221 83% 53%)' : 'hsl(var(--muted-foreground))',
  cursor: 'pointer',
  flexShrink: 0,
});

function PencilIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>;
}
function EraserIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/></svg>;
}
function LineIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="19" x2="19" y2="5"/></svg>;
}
function UndoIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>;
}
function RedoIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>;
}
function TrashIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
}

const ResenhaCanvas = forwardRef<ResenhaCanvasHandle, Props>(function ResenhaCanvas({ savedUrl }, ref) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const baseImgRef = useRef<HTMLImageElement>(null);
  const drawing    = useRef(false);
  const start      = useRef({ x: 0, y: 0 });
  const snapshot   = useRef<ImageData | null>(null);
  const undoStack  = useRef<ImageData[]>([]);
  const redoStack  = useRef<ImageData[]>([]);
  const dirty      = useRef(false);

  const [tool, setTool]   = useState<Tool>('pencil');
  const [size, setSize]   = useState(4);
  const [color, setColor] = useState(COLORS[0]);
  const [, bump]          = useState(0); // re-render p/ estado dos botões undo/redo

  function ctx() {
    return canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;
  }

  // Carrega resenha salva (se houver) sobre o canvas
  useEffect(() => {
    if (!savedUrl) return;
    const c = ctx();
    if (!c) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => c.drawImage(img, 0, 0, W, H);
    img.src = savedUrl;
  }, [savedUrl]);

  useImperativeHandle(ref, () => ({
    isDirty: () => dirty.current,
    async exportBlob() {
      const overlay = canvasRef.current;
      const base    = baseImgRef.current;
      if (!overlay) return null;
      const tmp = document.createElement('canvas');
      tmp.width = W;
      tmp.height = H;
      const t = tmp.getContext('2d')!;
      t.fillStyle = '#ffffff';
      t.fillRect(0, 0, W, H);
      if (base?.complete) t.drawImage(base, 0, 0, W, H);
      t.drawImage(overlay, 0, 0);
      return new Promise<Blob | null>((resolve) => tmp.toBlob(resolve, 'image/png'));
    },
  }));

  function toCanvasCoords(e: React.PointerEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function pushUndo() {
    const c = ctx();
    if (!c) return;
    undoStack.current.push(c.getImageData(0, 0, W, H));
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
  }

  function applyStroke(c: CanvasRenderingContext2D) {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = tool === 'eraser' ? Math.max(size * 3, 12) : size;
    c.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    c.strokeStyle = color;
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const c = ctx();
    if (!c) return;
    canvasRef.current!.setPointerCapture(e.pointerId);
    pushUndo();
    drawing.current = true;
    dirty.current = true;
    const p = toCanvasCoords(e);
    start.current = p;
    if (tool === 'line') {
      snapshot.current = c.getImageData(0, 0, W, H);
    } else {
      applyStroke(c);
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x + 0.01, p.y + 0.01); // ponto único
      c.stroke();
    }
    bump(v => v + 1);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    const c = ctx();
    if (!c) return;
    const p = toCanvasCoords(e);
    if (tool === 'line') {
      if (snapshot.current) c.putImageData(snapshot.current, 0, 0);
      applyStroke(c);
      c.beginPath();
      c.moveTo(start.current.x, start.current.y);
      c.lineTo(p.x, p.y);
      c.stroke();
    } else {
      c.lineTo(p.x, p.y);
      c.stroke();
    }
  }

  function onPointerUp() {
    drawing.current = false;
    snapshot.current = null;
    const c = ctx();
    if (c) c.globalCompositeOperation = 'source-over';
  }

  function undo() {
    const c = ctx();
    if (!c || undoStack.current.length === 0) return;
    redoStack.current.push(c.getImageData(0, 0, W, H));
    c.putImageData(undoStack.current.pop()!, 0, 0);
    bump(v => v + 1);
  }

  function redo() {
    const c = ctx();
    if (!c || redoStack.current.length === 0) return;
    undoStack.current.push(c.getImageData(0, 0, W, H));
    c.putImageData(redoStack.current.pop()!, 0, 0);
    bump(v => v + 1);
  }

  function clearAll() {
    const c = ctx();
    if (!c) return;
    pushUndo();
    c.clearRect(0, 0, W, H);
    dirty.current = true;
    bump(v => v + 1);
  }

  return (
    <div>
      {/* Barra de ferramentas */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
        padding: '0.5rem', borderRadius: '0.75rem 0.75rem 0 0',
        border: '1px solid hsl(var(--border))', borderBottom: 'none',
        background: 'hsl(var(--muted) / 0.4)',
      }}>
        <button type="button" title="Lápis"    onClick={() => setTool('pencil')} style={btnStyle(tool === 'pencil')}><PencilIcon /></button>
        <button type="button" title="Borracha" onClick={() => setTool('eraser')} style={btnStyle(tool === 'eraser')}><EraserIcon /></button>
        <button type="button" title="Linha"    onClick={() => setTool('line')}   style={btnStyle(tool === 'line')}><LineIcon /></button>

        <div style={{ width: 1, height: 22, background: 'hsl(var(--border))', margin: '0 4px' }} />

        {SIZES.map(s => (
          <button key={s} type="button" title={`Espessura ${s}px`} onClick={() => setSize(s)} style={btnStyle(size === s)}>
            <span style={{ width: Math.min(s + 4, 18), height: Math.min(s + 4, 18), borderRadius: '50%', background: 'currentColor', display: 'block' }} />
          </button>
        ))}

        <div style={{ width: 1, height: 22, background: 'hsl(var(--border))', margin: '0 4px' }} />

        {COLORS.map(c => (
          <button key={c} type="button" title="Cor" onClick={() => setColor(c)} style={btnStyle(color === c)}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: c, display: 'block', border: '1px solid hsl(var(--border))' }} />
          </button>
        ))}

        <div style={{ width: 1, height: 22, background: 'hsl(var(--border))', margin: '0 4px' }} />

        <button type="button" title="Desfazer" onClick={undo} disabled={undoStack.current.length === 0}
                style={{ ...btnStyle(false), opacity: undoStack.current.length === 0 ? 0.4 : 1 }}><UndoIcon /></button>
        <button type="button" title="Refazer" onClick={redo} disabled={redoStack.current.length === 0}
                style={{ ...btnStyle(false), opacity: redoStack.current.length === 0 ? 0.4 : 1 }}><RedoIcon /></button>
        <button type="button" title="Limpar anotações" onClick={clearAll} style={btnStyle(false)}><TrashIcon /></button>
      </div>

      {/* Área de desenho: diagrama base + canvas transparente por cima */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`,
        border: '1px solid hsl(var(--border))', borderRadius: '0 0 0.75rem 0.75rem',
        overflow: 'hidden', background: '#fff',
      }}>
        <img
          ref={baseImgRef}
          src="/images/resenha.svg"
          alt="Diagrama de resenha do equino"
          width={W}
          height={H}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', userSelect: 'none', pointerEvents: 'none' }}
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
      <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.375rem' }}>
        Marque os sinais do animal sobre o diagrama. A resenha é salva como imagem junto ao cadastro.
      </p>
    </div>
  );
});

export default ResenhaCanvas;
