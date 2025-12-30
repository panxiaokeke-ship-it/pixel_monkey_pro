
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PixelArt, ToolType, SymmetryMode, ThemeType } from '../types';
import { saveArt } from '../services/storage';
import { getAIInspiration } from '../services/gemini';
import { 
  ArrowLeft, Save, Undo2, Redo2, 
  PenTool, Eraser, PaintBucket, Pipette, 
  Download, Zap, Check, Sparkles, Grid3X3,
  ZoomIn, ZoomOut, Maximize, Hand,
  Columns, Rows, Grid2X2, CircleOff, Settings, MoreHorizontal, X, Cpu
} from 'lucide-react';

interface EditorProps {
  art: PixelArt;
  onBack: () => void;
  currentTheme: ThemeType;
  onSetTheme: (theme: ThemeType) => void;
}

export const Editor: React.FC<EditorProps> = ({ art, onBack, currentTheme, onSetTheme }) => {
  const [pixels, setPixels] = useState<string[]>(art.data);
  const [history, setHistory] = useState<string[][]>([art.data]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [currentTool, setCurrentTool] = useState<ToolType>('pen');
  const [currentColor, setCurrentColor] = useState('#ff6b00');
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>('none');
  const [brushSize, setBrushSize] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [showInspiration, setShowInspiration] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [aiTip, setAiTip] = useState<{idea: string, palette: string[]} | null>(null);

  // Drag and Drop State
  const [draggedColor, setDraggedColor] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  const pixelsRef = useRef<string[]>(pixels);
  const isChangedRef = useRef(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const lastTouchDistRef = useRef(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  
  const defaultPalette = [
    '#ff6b00', '#00d1ff', '#39ff14', '#ffffff', '#000000', 
    '#ff00ff', '#ffff00', '#7b2cbf', '#e07a5f', '#3d405b'
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pixels.forEach((color, i) => {
      const x = i % art.width;
      const y = Math.floor(i / art.width);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  }, [pixels, art.width, art.height]);

  const handleAction = useCallback((index: number, overrideColor?: string) => {
    if (currentTool === 'picker' && !overrideColor) {
      setCurrentColor(pixelsRef.current[index]);
      return;
    }

    const currentPixels = pixelsRef.current;
    const colorToApply = overrideColor || (currentTool === 'eraser' ? '#ffffff' : currentColor);

    const getBrushIndices = (idx: number): number[] => {
      const x = idx % art.width;
      const y = Math.floor(idx / art.width);
      const indices: number[] = [];
      const half = Math.floor(brushSize / 2);
      const startOffset = -half;
      const endOffset = brushSize % 2 === 0 ? half - 1 : half;

      for (let dy = startOffset; dy <= endOffset; dy++) {
        for (let dx = startOffset; dx <= endOffset; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < art.width && ny >= 0 && ny < art.height) {
            indices.push(ny * art.width + nx);
          }
        }
      }
      return indices;
    };

    const getSymmetricIndices = (baseIndices: number[]): number[] => {
      let allIndices = [...baseIndices];
      const mirrorX = (idx: number) => {
        const x = idx % art.width;
        const y = Math.floor(idx / art.width);
        return y * art.width + (art.width - 1 - x);
      };
      const mirrorY = (idx: number) => {
        const x = idx % art.width;
        const y = Math.floor(idx / art.width);
        return (art.height - 1 - y) * art.width + x;
      };

      if (symmetryMode === 'vertical' || symmetryMode === 'quad') {
        const currentBatch = [...allIndices];
        allIndices = allIndices.concat(currentBatch.map(mirrorX));
      }
      if (symmetryMode === 'horizontal' || symmetryMode === 'quad') {
        const currentBatch = [...allIndices];
        allIndices = allIndices.concat(currentBatch.map(mirrorY));
      }
      return Array.from(new Set(allIndices));
    };

    const nextPixels = [...currentPixels];
    let changed = false;

    if (currentTool === 'pen' || currentTool === 'eraser' || overrideColor) {
      const brushIndices = getBrushIndices(index);
      const finalIndices = getSymmetricIndices(brushIndices);
      finalIndices.forEach(i => {
        if (nextPixels[i] !== colorToApply) {
          nextPixels[i] = colorToApply;
          changed = true;
        }
      });
    } else if (currentTool === 'fill') {
      const targetColor = nextPixels[index];
      if (targetColor === currentColor) return;

      const fill = (idx: number) => {
        const stack = [idx];
        while (stack.length > 0) {
          const curr = stack.pop()!;
          if (nextPixels[curr] !== targetColor) continue;
          nextPixels[curr] = currentColor;
          changed = true;
          const x = curr % art.width;
          const y = Math.floor(curr / art.width);
          if (x > 0) stack.push(curr - 1);
          if (x < art.width - 1) stack.push(curr + 1);
          if (y > 0) stack.push(curr - art.width);
          if (y < art.height - 1) stack.push(curr + art.width);
        }
      };
      
      const symmetryStarts = getSymmetricIndices([index]);
      symmetryStarts.forEach(startIdx => {
        if (nextPixels[startIdx] === targetColor) fill(startIdx);
      });
    }

    if (changed) {
      pixelsRef.current = nextPixels;
      setPixels(nextPixels);
      isChangedRef.current = true;
      
      // If it was a drop action (one-shot), save history immediately
      if (overrideColor) {
        const nextHist = history.slice(0, historyIndex + 1);
        nextHist.push([...nextPixels]);
        if (nextHist.length > 50) nextHist.shift();
        setHistory(nextHist);
        setHistoryIndex(nextHist.length - 1);
        isChangedRef.current = false;
      }
    }
  }, [currentTool, currentColor, art.width, art.height, symmetryMode, brushSize, history, historyIndex]);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (currentTool === 'pan') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const x = Math.floor((clientX - rect.left) / (rect.width / art.width));
    const y = Math.floor((clientY - rect.top) / (rect.height / art.height));
    if (x >= 0 && x < art.width && y >= 0 && y < art.height) {
      handleAction(y * art.width + x);
    }
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 10));
  }, []);

  const startDragging = (e: React.MouseEvent | React.TouchEvent) => {
    isDraggingRef.current = true;
    isChangedRef.current = false;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    lastPosRef.current = { x: clientX, y: clientY };

    if ('touches' in e && e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lastTouchDistRef.current = dist;
    } else {
      handleInteraction(e);
    }
  };

  const onDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    if (draggedColor) {
      setDragPosition({ x: clientX, y: clientY });
      return;
    }

    if (!isDraggingRef.current) return;
    if ('touches' in e && e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const delta = dist / lastTouchDistRef.current;
      setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 10));
      lastTouchDistRef.current = dist;
      return;
    }
    
    if (currentTool === 'pan') {
      const dx = clientX - lastPosRef.current.x;
      const dy = clientY - lastPosRef.current.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    } else {
      handleInteraction(e);
    }
    lastPosRef.current = { x: clientX, y: clientY };
  };

  const stopDragging = (e: React.MouseEvent | React.TouchEvent) => {
    if (draggedColor) {
      const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;
      
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((clientX - rect.left) / (rect.width / art.width));
        const y = Math.floor((clientY - rect.top) / (rect.height / art.height));
        if (x >= 0 && x < art.width && y >= 0 && y < art.height) {
          handleAction(y * art.width + x, draggedColor);
        }
      }
      setDraggedColor(null);
    }

    if (isDraggingRef.current) {
      if (isChangedRef.current) {
        const nextHist = history.slice(0, historyIndex + 1);
        nextHist.push([...pixelsRef.current]);
        if (nextHist.length > 50) nextHist.shift();
        setHistory(nextHist);
        setHistoryIndex(nextHist.length - 1);
        isChangedRef.current = false;
      }
      if (currentTool === 'picker') {
        setCurrentTool('pen');
      }
    }
    isDraggingRef.current = false;
  };

  const onPaletteDragStart = (e: React.MouseEvent | React.TouchEvent, color: string) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDraggedColor(color);
    setDragPosition({ x: clientX, y: clientY });
  };

  const onCanvasDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (currentTool === 'picker') {
       const canvas = canvasRef.current;
       if (!canvas) return;
       const rect = canvas.getBoundingClientRect();
       const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
       const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
       const x = Math.floor((clientX - rect.left) / (rect.width / art.width));
       const y = Math.floor((clientY - rect.top) / (rect.height / art.height));
       if (x >= 0 && x < art.width && y >= 0 && y < art.height) {
         setDraggedColor(pixelsRef.current[y * art.width + x]);
         setDragPosition({ x: clientX, y: clientY });
         return;
       }
    }
    startDragging(e);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      const state = history[nextIdx];
      setHistoryIndex(nextIdx);
      setPixels(state);
      pixelsRef.current = state;
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      const state = history[nextIdx];
      setHistoryIndex(nextIdx);
      setPixels(state);
      pixelsRef.current = state;
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preview = canvas.toDataURL();
    saveArt({ ...art, data: pixels, preview });
    setTimeout(() => setIsSaving(false), 800);
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const cycleSymmetry = () => {
    const modes: SymmetryMode[] = ['none', 'vertical', 'horizontal', 'quad'];
    const nextIndex = (modes.indexOf(symmetryMode) + 1) % modes.length;
    setSymmetryMode(modes[nextIndex]);
  };

  const getSymmetryIcon = (mode: string, size = 24) => {
    switch (mode) {
      case 'vertical': return <Columns size={size} />;
      case 'horizontal': return <Rows size={size} />;
      case 'quad': return <Grid2X2 size={size} />;
      default: return <CircleOff size={size} />;
    }
  };

  const isBrushTool = currentTool === 'pen' || currentTool === 'eraser';

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-color)] text-[var(--text-color)] theme-transition select-none">
      {/* Editor Header */}
      <header className="p-4 bg-[var(--hardware-beige)] border-b-4 border-[var(--border-color)] flex justify-between items-center text-[var(--text-color)] z-[100]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="cassette-button p-1">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="font-black italic uppercase text-sm leading-none">{art.name}</h2>
            <div className="flex gap-1 mt-1">
               <div className="w-10 h-1 bg-[var(--border-color)] opacity-20"></div>
               <div className="w-4 h-1 bg-[var(--accent-orange)]"></div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)} className="p-2 border-2 border-[var(--border-color)] bg-[var(--hardware-beige)] active:scale-95 transition-all">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      {/* Monitor Area */}
      <div 
        ref={viewportRef}
        className="flex-1 bg-[var(--monitor-bg)] flex items-center justify-center p-6 relative overflow-hidden touch-none"
        onWheel={handleWheel}
        onMouseDown={onCanvasDragStart}
        onMouseMove={onDrag}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        onTouchStart={onCanvasDragStart}
        onTouchMove={onDrag}
        onTouchEnd={stopDragging}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(var(--led-green) 1px, transparent 1px), linear-gradient(90deg, var(--led-green) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        
        <div 
          className="relative p-2 bg-[var(--hardware-beige)] border-4 border-[var(--border-color)] rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-transform duration-75 ease-out"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
           <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none z-10"></div>
           <canvas 
            ref={canvasRef}
            width={art.width}
            height={art.height}
            className="w-[80vw] max-w-[360px] aspect-square bg-white pointer-events-none"
          />
          
          {symmetryMode !== 'none' && (
            <div className="absolute inset-2 pointer-events-none z-30 opacity-30">
              {(symmetryMode === 'vertical' || symmetryMode === 'quad') && <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-[var(--accent-orange)] -translate-x-1/2"></div>}
              {(symmetryMode === 'horizontal' || symmetryMode === 'quad') && <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-[var(--accent-orange)] -translate-y-1/2"></div>}
            </div>
          )}

          {showGrid && (
            <div className="absolute inset-2 pointer-events-none z-20" style={{ backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.15) 1px, transparent 1px)`, backgroundSize: `${100 / art.width}% ${100 / art.height}%` }} />
          )}
        </div>

        <div className="absolute bottom-4 left-6 font-mono text-[10px] text-[var(--led-green)] opacity-50 space-y-1">
          <p>RESOLUTION: {art.width}X{art.height}</p>
          <p>ZOOM: {Math.round(zoom * 100)}%</p>
          <p>MIRROR: {symmetryMode.toUpperCase()}</p>
          {isBrushTool && <p>BRUSH: {brushSize}PX</p>}
        </div>
        
        <div className="absolute top-4 right-6 flex flex-col gap-3 z-50">
          <div className="flex flex-col bg-white/5 border border-white/10 p-1 gap-1">
             <button onClick={() => setZoom(prev => Math.min(prev + 0.5, 10))} className="cassette-button p-2"><ZoomIn size={18}/></button>
             <button onClick={() => setZoom(prev => Math.max(prev - 0.5, 0.5))} className="cassette-button p-2"><ZoomOut size={18}/></button>
             <button onClick={resetZoom} className="cassette-button p-2"><Maximize size={18}/></button>
          </div>
          <button onClick={cycleSymmetry} className={`cassette-button p-3 transition-colors ${symmetryMode !== 'none' ? 'text-[var(--accent-orange)]' : 'opacity-40'}`}>
            {getSymmetryIcon(symmetryMode)}
          </button>
          <button onClick={() => setShowGrid(!showGrid)} className={`cassette-button p-3 transition-colors ${showGrid ? 'text-[var(--accent-orange)]' : 'opacity-40'}`}>
            <Grid3X3 size={24} />
          </button>
          <button onClick={() => { setShowInspiration(true); getAIInspiration().then(setAiTip); }} className="cassette-button p-3 text-[var(--accent-orange)]">
            <Zap size={24} fill="currentColor" />
          </button>
          <button onClick={handleSave} className="cassette-button p-3 text-[var(--accent-blue)]">
            <Download size={24} />
          </button>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-[var(--hardware-beige)] border-t-8 border-[var(--panel-shadow)] p-4 safe-bottom text-[var(--text-color)] z-[100]">
        
        {isBrushTool && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-3 bg-[var(--hardware-dark)] border-2 border-[var(--border-color)] p-2">
              <span className="text-[10px] font-black opacity-60 uppercase shrink-0">SIZE:</span>
              <div className="flex-1 flex gap-1">
                {[1, 2, 3, 4, 6].map(s => (
                  <button key={s} onClick={() => setBrushSize(s)} className={`flex-1 h-6 text-[10px] font-mono border transition-all ${brushSize === s ? 'bg-[var(--accent-orange)] border-white text-white' : 'bg-black/20 border-[var(--border-color)]'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 bg-[var(--hardware-dark)] border-2 border-[var(--border-color)] p-2">
              <span className="text-[10px] font-black opacity-60 uppercase shrink-0">MIRROR:</span>
              <div className="flex-1 flex gap-1">
                {(['none', 'vertical', 'horizontal', 'quad'] as SymmetryMode[]).map(m => (
                  <button key={m} onClick={() => setSymmetryMode(m)} className={`flex-1 h-6 flex items-center justify-center border transition-all ${symmetryMode === m ? 'bg-[var(--accent-orange)] border-white text-white' : 'bg-black/20 border-[var(--border-color)]'}`}>
                    {getSymmetryIcon(m, 14)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mb-4">
           <div className="flex-1 flex gap-2">
              <button onClick={undo} disabled={historyIndex === 0} className="cassette-button flex-1 py-1 font-bold text-xs disabled:opacity-30 flex items-center justify-center gap-1">
                <Undo2 size={14} /> UNDO
              </button>
              <button onClick={redo} disabled={historyIndex === history.length - 1} className="cassette-button flex-1 py-1 font-bold text-xs disabled:opacity-30 flex items-center justify-center gap-1">
                REDO <Redo2 size={14} />
              </button>
           </div>
           {/* Color Indicator Area - Droppable target */}
           <div 
              className="flex items-center gap-2 bg-[var(--hardware-dark)] p-2 border-2 border-[var(--border-color)] transition-colors active:scale-95"
              onMouseUp={() => draggedColor && setCurrentColor(draggedColor)}
              onTouchEnd={() => draggedColor && setCurrentColor(draggedColor)}
              onClick={() => (document.querySelector('input[type="color"]') as HTMLInputElement)?.click()}
           >
              <div className="w-8 h-8 shrink-0 border border-white" style={{ backgroundColor: currentColor }}></div>
              <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} className="w-4 h-4 opacity-0 absolute pointer-events-none" />
              <span className="font-mono text-[10px] text-[var(--led-green)] uppercase">{currentColor}</span>
           </div>
        </div>

        {/* Palette Area - Droppable target for setting current color */}
        <div 
          className="flex gap-1.5 overflow-x-auto pb-4 no-scrollbar"
          onMouseUp={() => draggedColor && setCurrentColor(draggedColor)}
          onTouchEnd={() => draggedColor && setCurrentColor(draggedColor)}
        >
          {(aiTip?.palette || defaultPalette).map((c, i) => (
            <button 
              key={i} 
              onMouseDown={(e) => onPaletteDragStart(e, c)}
              onTouchStart={(e) => onPaletteDragStart(e, c)}
              onClick={() => setCurrentColor(c)} 
              className={`w-9 h-9 shrink-0 border-2 transition-all ${currentColor === c ? 'border-[var(--accent-orange)] scale-110 z-10 shadow-lg' : 'border-[var(--border-color)]'}`} 
              style={{ backgroundColor: c }} 
            />
          ))}
        </div>

        <div className="flex justify-between gap-2 border-t-2 border-[var(--panel-shadow)] pt-4">
          <ControlDeckButton active={currentTool === 'pen'} onClick={() => setCurrentTool('pen')} icon={<PenTool size={22} />} label="PEN" />
          <ControlDeckButton active={currentTool === 'eraser'} onClick={() => setCurrentTool('eraser')} icon={<Eraser size={22} />} label="DEL" />
          <ControlDeckButton active={currentTool === 'fill'} onClick={() => setCurrentTool('fill')} icon={<PaintBucket size={22} />} label="FILL" />
          <ControlDeckButton active={currentTool === 'picker'} onClick={() => setCurrentTool('picker')} icon={<Pipette size={22} />} label="PICK" title="Picker tool: Pick color or Drag from canvas to move color" />
          <ControlDeckButton active={currentTool === 'pan'} onClick={() => setCurrentTool('pan')} icon={<Hand size={22} />} label="PAN" />
        </div>
      </div>

      {/* Dragging Color Preview */}
      {draggedColor && (
        <div 
          className="fixed pointer-events-none z-[1000] w-8 h-8 border-2 border-white shadow-xl rounded-sm"
          style={{ 
            backgroundColor: draggedColor,
            left: dragPosition.x - 16,
            top: dragPosition.y - 16,
            transform: 'scale(1.5)'
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-6 z-[300]">
           <div className="bg-[var(--hardware-beige)] border-4 border-[var(--border-color)] p-6 w-full max-w-sm text-[var(--text-color)]">
              <div className="flex justify-between items-center mb-6 border-b-2 border-[var(--panel-shadow)] pb-2">
                 <div className="flex items-center gap-2">
                    <Cpu size={20} />
                    <h2 className="text-lg font-bold uppercase tracking-tight">System Settings</h2>
                 </div>
                 <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-black/10"><X size={24} /></button>
              </div>

              <div className="space-y-6">
                 <div>
                    <label className="block text-[10px] font-bold uppercase mb-3">Interface Theme</label>
                    <div className="grid grid-cols-2 gap-3">
                       <ThemeButton active={currentTheme === 'gameboy'} onClick={() => onSetTheme('gameboy')} label="Game Boy" color="#8bac0f" />
                       <ThemeButton active={currentTheme === 'cassette'} onClick={() => onSetTheme('cassette')} label="Futurism" color="#d1d1c4" />
                       <ThemeButton active={currentTheme === 'cyberpunk'} onClick={() => onSetTheme('cyberpunk')} label="Neon Night" color="#1a0b2e" />
                       <ThemeButton active={currentTheme === 'stealth'} onClick={() => onSetTheme('stealth')} label="OLED Stealth" color="#000000" />
                    </div>
                 </div>

                 <div className="pt-4 flex gap-2">
                    <button onClick={handleSave} className="flex-1 bg-[var(--accent-orange)] p-3 border-2 border-[var(--border-color)] text-white font-black uppercase flex items-center justify-center gap-2">
                       {isSaving ? <Check size={18} /> : <Save size={18} />}
                       <span>{isSaving ? 'SAVED' : 'SAVE UNIT'}</span>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* AI Inspiration Overlay */}
      {showInspiration && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-[300]">
           <div className="bg-black border-2 border-[var(--led-green)] p-6 w-full max-w-sm relative">
              <div className="absolute -top-4 left-6 label-tag !bg-[var(--led-green)] !text-black">NEURAL_LINK_ACTIVE</div>
              {aiTip ? (
                <div className="space-y-6">
                  <p className="text-[var(--led-green)] font-mono text-sm leading-relaxed">
                    <span className="block text-[8px] opacity-50 mb-2">> INCOMING_IDEA:</span>
                    {aiTip.idea}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {aiTip.palette.map((c, i) => (
                      <button key={i} onClick={() => setCurrentColor(c)} className={`h-10 border transition-all ${currentColor === c ? 'border-[var(--led-green)] scale-110 shadow-[0_0_15px_var(--led-green)] z-10' : 'border-[var(--led-green)]/30'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <button onClick={() => setShowInspiration(false)} className="w-full py-4 border-2 border-[var(--led-green)] text-[var(--led-green)] font-black uppercase hover:bg-[var(--led-green)]/10">EXECUTE</button>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center">
                  <div className="w-8 h-8 border-2 border-[var(--led-green)] border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 font-mono text-[var(--led-green)] animate-pulse text-xs">RETRIEVING_DATA...</p>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

const ThemeButton: React.FC<{ active: boolean, onClick: () => void, label: string, color: string }> = ({ active, onClick, label, color }) => (
  <button onClick={onClick} className={`p-3 border-2 flex flex-col items-center gap-2 transition-all ${active ? 'border-[var(--accent-orange)] bg-white/10' : 'border-[var(--panel-shadow)] opacity-60'}`}>
     <div className="w-8 h-8 border border-black/20 shadow-sm" style={{ backgroundColor: color }}></div>
     <span className="text-[10px] font-bold uppercase">{label}</span>
  </button>
);

const ControlDeckButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string, title?: string }> = ({ active, onClick, icon, label, title }) => (
  <button 
    onClick={onClick}
    title={title}
    className={`flex-1 flex flex-col items-center justify-center py-2 border-2 transition-all ${active ? 'bg-[var(--accent-orange)] border-[var(--border-color)] text-white translate-y-1 shadow-none' : 'bg-[var(--hardware-beige)] border-[var(--border-color)] text-[var(--text-color)] shadow-[0_4px_0_0_var(--panel-shadow)]'}`}
  >
    {icon}
    <span className="text-[9px] font-black mt-1">{label}</span>
  </button>
);
