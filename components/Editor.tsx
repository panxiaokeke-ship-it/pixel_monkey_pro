
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PixelArt, ToolType, SymmetryMode, ThemeType } from '../types';
import { saveArt } from '../services/storage';
import { getAIInspiration } from '../services/gemini';
import { 
  ArrowLeft, Save, Undo2, Redo2, 
  PenTool, Eraser, PaintBucket, Pipette, 
  Download, Zap, Check, Grid3X3,
  ZoomIn, ZoomOut, Maximize, Hand,
  Columns, Rows, Grid2X2, CircleOff, MoreHorizontal, X, Cpu,
  ImageDown
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
    setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 20));
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
      setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 20));
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

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Create a temporary link to download the high-res pixel art
    const link = document.createElement('a');
    link.download = `${art.name}_export.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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
    <div className="flex flex-col md:flex-row h-screen bg-[var(--bg-color)] text-[var(--text-color)] theme-transition select-none overflow-hidden">
      
      {/* Sidebar Layout for Tablet/PC */}
      <div className="hidden md:flex flex-col w-20 lg:w-24 bg-[var(--hardware-beige)] border-r-8 border-[var(--panel-shadow)] p-3 items-center gap-4 z-50">
        <button onClick={onBack} className="cassette-button p-3 hover:scale-110 transition-all mb-4">
          <ArrowLeft size={24} />
        </button>
        <SidebarToolButton active={currentTool === 'pen'} onClick={() => setCurrentTool('pen')} icon={<PenTool size={28} />} label="PEN" />
        <SidebarToolButton active={currentTool === 'eraser'} onClick={() => setCurrentTool('eraser')} icon={<Eraser size={28} />} label="DEL" />
        <SidebarToolButton active={currentTool === 'fill'} onClick={() => setCurrentTool('fill')} icon={<PaintBucket size={28} />} label="FILL" />
        <SidebarToolButton active={currentTool === 'picker'} onClick={() => setCurrentTool('picker')} icon={<Pipette size={28} />} label="PICK" />
        <SidebarToolButton active={currentTool === 'pan'} onClick={() => setCurrentTool('pan')} icon={<Hand size={28} />} label="PAN" />
        <div className="mt-auto flex flex-col gap-3">
          <button onClick={() => setShowSettings(true)} className="p-3 border-2 border-[var(--border-color)] bg-[var(--hardware-beige)] hover:bg-black/10 transition-all rounded-sm"><MoreHorizontal size={24} /></button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative">
        {/* Editor Header (Mobile Only) */}
        <header className="p-4 md:hidden bg-[var(--hardware-beige)] border-b-4 border-[var(--border-color)] flex justify-between items-center text-[var(--text-color)] z-[100]">
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
          <button onClick={() => setShowSettings(true)} className="p-2 border-2 border-[var(--border-color)] bg-[var(--hardware-beige)] active:scale-95 transition-all">
            <MoreHorizontal size={20} />
          </button>
        </header>

        {/* Desktop Top Nav */}
        <header className="hidden md:flex p-4 bg-[var(--hardware-beige)] border-b-4 border-[var(--panel-shadow)] justify-between items-center text-[var(--text-color)] z-40">
           <div className="flex items-center gap-4">
              <h2 className="font-black italic uppercase text-xl">{art.name}</h2>
              <span className="label-tag">Unit: {art.width}x{art.height}</span>
           </div>
           <div className="flex gap-4">
              <button onClick={undo} disabled={historyIndex === 0} className="cassette-button px-4 py-2 text-sm disabled:opacity-30">UNDO</button>
              <button onClick={redo} disabled={historyIndex === history.length - 1} className="cassette-button px-4 py-2 text-sm disabled:opacity-30">REDO</button>
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
            className="relative p-2 bg-[var(--hardware-beige)] border-4 border-[var(--border-color)] rounded-sm shadow-[0_0_80px_rgba(0,0,0,0.8)] transition-transform duration-75 ease-out"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
             <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/20 to-transparent pointer-events-none z-10"></div>
             <canvas 
              ref={canvasRef}
              width={art.width}
              height={art.height}
              className="w-[80vw] max-w-[360px] md:max-w-[500px] aspect-square bg-white pointer-events-none"
            />
            
            {symmetryMode !== 'none' && (
              <div className="absolute inset-2 pointer-events-none z-30 opacity-40">
                {(symmetryMode === 'vertical' || symmetryMode === 'quad') && <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-[var(--accent-orange)] -translate-x-1/2"></div>}
                {(symmetryMode === 'horizontal' || symmetryMode === 'quad') && <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-[var(--accent-orange)] -translate-y-1/2"></div>}
              </div>
            )}

            {showGrid && (
              <div className="absolute inset-2 pointer-events-none z-20" style={{ backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.2) 1px, transparent 1px)`, backgroundSize: `${100 / art.width}% ${100 / art.height}%` }} />
            )}
          </div>

          <div className="absolute bottom-4 left-6 font-mono text-[10px] md:text-xs text-[var(--led-green)] font-black opacity-80 space-y-1 drop-shadow-[0_2px_2px_black]">
            <p>RES: {art.width}X{art.height}</p>
            <p>MAG: {Math.round(zoom * 100)}%</p>
            <p>SYM: {symmetryMode.toUpperCase()}</p>
          </div>
          
          <div className="absolute top-4 right-6 flex flex-col gap-3 z-50">
            <div className="flex flex-col bg-white/10 backdrop-blur-sm border-2 border-white/20 p-1 gap-1 rounded-sm">
               <button onClick={() => setZoom(prev => Math.min(prev * 1.2, 20))} className="cassette-button p-3"><ZoomIn size={20}/></button>
               <button onClick={() => setZoom(prev => Math.max(prev * 0.8, 0.5))} className="cassette-button p-3"><ZoomOut size={20}/></button>
               <button onClick={resetZoom} className="cassette-button p-3"><Maximize size={20}/></button>
            </div>
            <button onClick={cycleSymmetry} className={`cassette-button p-4 transition-all ${symmetryMode !== 'none' ? 'bg-[var(--accent-orange)] text-white' : ''}`}>
              {getSymmetryIcon(symmetryMode, 24)}
            </button>
            <button onClick={() => setShowGrid(!showGrid)} className={`cassette-button p-4 transition-all ${showGrid ? 'bg-[var(--accent-orange)] text-white' : ''}`}>
              <Grid3X3 size={24} />
            </button>
            <button onClick={() => { setShowInspiration(true); getAIInspiration().then(setAiTip); }} className="cassette-button p-4 text-[var(--accent-orange)] hover:bg-[var(--accent-orange)] hover:text-white transition-all">
              <Zap size={24} fill="currentColor" />
            </button>
            
            <div className="flex flex-col gap-2">
              <button onClick={handleSave} className="cassette-button p-4 text-[var(--accent-blue)] flex flex-col items-center">
                <Download size={24} />
                <span className="text-[8px] font-black mt-1">SAVE</span>
              </button>
              <button onClick={handleExportPNG} className="cassette-button p-4 text-[var(--accent-orange)] flex flex-col items-center bg-white/50">
                <ImageDown size={24} />
                <span className="text-[8px] font-black mt-1">EXPORT PNG</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Control Panel */}
        <div className="md:hidden bg-[var(--hardware-beige)] border-t-8 border-[var(--panel-shadow)] p-4 safe-bottom text-[var(--text-color)] z-[100]">
          
          {isBrushTool && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3 bg-[var(--hardware-dark)] border-2 border-[var(--border-color)] p-2">
                <span className="text-[10px] font-black text-white uppercase shrink-0">SIZE:</span>
                <div className="flex-1 flex gap-1">
                  {[1, 2, 3, 4].map(s => (
                    <button key={s} onClick={() => setBrushSize(s)} className={`flex-1 h-8 text-xs font-black border-2 transition-all ${brushSize === s ? 'bg-[var(--accent-orange)] border-white text-white' : 'bg-black/40 border-white/10 text-white/50'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 mb-4">
             <div className="flex-1 flex gap-2">
                <button onClick={undo} disabled={historyIndex === 0} className="cassette-button flex-1 py-2 font-black text-xs disabled:opacity-30 flex items-center justify-center gap-1">
                  <Undo2 size={14} /> UNDO
                </button>
                <button onClick={redo} disabled={historyIndex === history.length - 1} className="cassette-button flex-1 py-2 font-black text-xs disabled:opacity-30 flex items-center justify-center gap-1">
                  REDO <Redo2 size={14} />
                </button>
             </div>
             
             <div 
                className="flex items-center gap-2 bg-[var(--hardware-dark)] p-2 border-2 border-[var(--border-color)] transition-colors active:scale-95 cursor-pointer"
                onMouseUp={() => draggedColor && setCurrentColor(draggedColor)}
                onTouchEnd={() => draggedColor && setCurrentColor(draggedColor)}
                onClick={() => (document.querySelector('input[type="color"]') as HTMLInputElement)?.click()}
             >
                <div className="w-8 h-8 shrink-0 border-2 border-white shadow-sm" style={{ backgroundColor: currentColor }}></div>
                <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} className="w-4 h-4 opacity-0 absolute pointer-events-none" />
                <span className="font-mono text-[10px] text-[var(--led-green)] uppercase font-black">{currentColor}</span>
             </div>
          </div>

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
                className={`w-10 h-10 shrink-0 border-4 transition-all ${currentColor === c ? 'border-white scale-110 z-10 shadow-lg' : 'border-[var(--border-color)]'}`} 
                style={{ backgroundColor: c }} 
              />
            ))}
          </div>

          <div className="flex justify-between gap-2 border-t-2 border-[var(--panel-shadow)] pt-4">
            <ControlDeckButton active={currentTool === 'pen'} onClick={() => setCurrentTool('pen')} icon={<PenTool size={22} />} label="PEN" />
            <ControlDeckButton active={currentTool === 'eraser'} onClick={() => setCurrentTool('eraser')} icon={<Eraser size={22} />} label="DEL" />
            <ControlDeckButton active={currentTool === 'fill'} onClick={() => setCurrentTool('fill')} icon={<PaintBucket size={22} />} label="FILL" />
            <ControlDeckButton active={currentTool === 'picker'} onClick={() => setCurrentTool('picker')} icon={<Pipette size={22} />} label="PICK" />
            <ControlDeckButton active={currentTool === 'pan'} onClick={() => setCurrentTool('pan')} icon={<Hand size={22} />} label="PAN" />
          </div>
        </div>

        {/* Desktop Color Sidebar */}
        <div className="hidden md:flex flex-col w-48 lg:w-56 bg-[var(--hardware-beige)] border-l-8 border-[var(--panel-shadow)] absolute right-0 h-full p-4 z-40">
           <div className="mb-6">
              <label className="block text-[10px] font-black uppercase mb-2">ACTIVE_COLOR</label>
              <div 
                className="w-full aspect-video border-4 border-[var(--border-color)] shadow-inner relative flex items-center justify-center group cursor-pointer"
                style={{ backgroundColor: currentColor }}
                onClick={() => (document.querySelector('input[type="color"]') as HTMLInputElement)?.click()}
              >
                 <div className="bg-black/40 px-2 py-1 font-mono text-white text-xs font-black backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform">
                    {currentColor.toUpperCase()}
                 </div>
                 <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} className="w-0 h-0 opacity-0 absolute" />
              </div>
           </div>

           <div className="mb-6">
              <label className="block text-[10px] font-black uppercase mb-2">PALETTE_DRIVE</label>
              <div className="grid grid-cols-4 gap-2">
                {(aiTip?.palette || defaultPalette).map((c, i) => (
                  <button 
                    key={i} 
                    onMouseDown={(e) => onPaletteDragStart(e, c)}
                    onClick={() => setCurrentColor(c)} 
                    className={`aspect-square border-2 transition-all ${currentColor === c ? 'border-[var(--accent-orange)] scale-110 shadow-md ring-2 ring-white' : 'border-[var(--border-color)] hover:scale-105'}`} 
                    style={{ backgroundColor: c }} 
                  />
                ))}
              </div>
           </div>

           <div className="space-y-4 pt-4 border-t-2 border-[var(--panel-shadow)]">
              <div className="bg-[var(--hardware-dark)] p-3 border-2 border-[var(--border-color)]">
                <span className="block text-[10px] font-black text-white uppercase mb-2">BRUSH_WIDTH</span>
                <input 
                  type="range" min="1" max="10" value={brushSize} 
                  onChange={(e) => setBrushSize(parseInt(e.target.value))} 
                  className="w-full accent-[var(--accent-orange)]"
                />
                <div className="flex justify-between mt-1 text-[8px] font-black text-[var(--led-green)]">
                  <span>1PX</span>
                  <span>{brushSize}PX</span>
                  <span>10PX</span>
                </div>
              </div>

              <div className="bg-[var(--hardware-dark)] p-3 border-2 border-[var(--border-color)]">
                <span className="block text-[10px] font-black text-white uppercase mb-2">SYMMETRY_ENGINE</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['none', 'vertical', 'horizontal', 'quad'] as SymmetryMode[]).map(m => (
                    <button key={m} onClick={() => setSymmetryMode(m)} className={`p-2 border-2 flex items-center justify-center transition-all ${symmetryMode === m ? 'bg-[var(--accent-orange)] border-white text-white' : 'bg-black/30 border-white/10 text-white/40 hover:text-white'}`}>
                      {getSymmetryIcon(m, 18)}
                    </button>
                  ))}
                </div>
              </div>
           </div>

           <div className="mt-auto">
              <button onClick={handleSave} className="w-full bg-[var(--accent-orange)] text-white p-4 font-black uppercase border-4 border-[var(--border-color)] shadow-[4px_4px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2">
                 <Save size={20} /> SAVE DATA
              </button>
           </div>
        </div>
      </div>

      {/* Dragging Color Preview */}
      {draggedColor && (
        <div 
          className="fixed pointer-events-none z-[1000] w-10 h-10 border-4 border-white shadow-2xl rounded-sm"
          style={{ 
            backgroundColor: draggedColor,
            left: dragPosition.x - 20,
            top: dragPosition.y - 20,
            transform: 'scale(1.5)'
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-[1000]">
           <div className="bg-[var(--hardware-beige)] border-8 border-[var(--border-color)] p-8 w-full max-w-md text-[var(--text-color)] shadow-[30px_30px_0px_rgba(0,0,0,0.6)]">
              <div className="flex justify-between items-center mb-8 border-b-4 border-[var(--panel-shadow)] pb-4">
                 <div className="flex items-center gap-3">
                    <Cpu size={28} className="text-[var(--accent-orange)]" />
                    <h2 className="text-2xl font-black uppercase tracking-tight">System Configuration</h2>
                 </div>
                 <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-black/10 transition-colors"><X size={32} /></button>
              </div>

              <div className="space-y-8">
                 <div>
                    <label className="block text-xs font-black uppercase mb-4">Interface Visual Profile</label>
                    <div className="grid grid-cols-2 gap-4">
                       <ThemeButton active={currentTheme === 'gameboy'} onClick={() => onSetTheme('gameboy')} label="Original DMG" color="#8bac0f" />
                       <ThemeButton active={currentTheme === 'cassette'} onClick={() => onSetTheme('cassette')} label="Analog Hi-Fi" color="#ff6b00" />
                       <ThemeButton active={currentTheme === 'cyberpunk'} onClick={() => onSetTheme('cyberpunk')} label="Neon Grid" color="#ff00ff" />
                       <ThemeButton active={currentTheme === 'stealth'} onClick={() => onSetTheme('stealth')} label="Black Ops" color="#333333" />
                    </div>
                 </div>

                 <div className="pt-6 border-t-4 border-[var(--panel-shadow)] flex gap-4">
                    <button onClick={handleSave} className="flex-1 bg-[var(--accent-orange)] p-5 border-4 border-[var(--border-color)] text-white font-black uppercase text-lg shadow-[6px_6px_0px_var(--border-color)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-3">
                       {isSaving ? <Check size={24} strokeWidth={4} /> : <Save size={24} strokeWidth={4} />}
                       <span>{isSaving ? 'UNIT_SAVED' : 'SAVE_UNIT'}</span>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* AI Inspiration Overlay */}
      {showInspiration && (
        <div className="fixed inset-0 bg-black/98 flex items-center justify-center p-6 z-[1000]">
           <div className="bg-black border-4 border-[var(--led-green)] p-10 w-full max-w-lg relative shadow-[0_0_50px_var(--led-green)]">
              <div className="absolute -top-5 left-10 label-tag !bg-[var(--led-green)] !text-black !text-sm">NEURAL_LINK_ACTIVE_100%</div>
              {aiTip ? (
                <div className="space-y-10">
                  <div className="font-mono text-lg leading-relaxed text-white">
                    <span className="block text-xs text-[var(--led-green)] opacity-70 mb-4 animate-pulse">> INCOMING_IDEA_STREAM:</span>
                    <span className="bg-[var(--led-green)] text-black px-2">{aiTip.idea}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-[var(--led-green)] opacity-70 mb-4">> SPECTRAL_PALETTE:</span>
                    <div className="grid grid-cols-5 gap-4">
                      {aiTip.palette.map((c, i) => (
                        <button key={i} onClick={() => {setCurrentColor(c); setShowInspiration(false);}} className={`aspect-square border-4 transition-all ${currentColor === c ? 'border-[var(--led-green)] scale-110 shadow-[0_0_25px_var(--led-green)] z-10' : 'border-white/20 hover:border-white'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setShowInspiration(false)} className="w-full py-6 border-4 border-[var(--led-green)] text-[var(--led-green)] font-black uppercase text-xl hover:bg-[var(--led-green)] hover:text-black transition-all">EXECUTE_MODIFICATION</button>
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center">
                  <div className="w-12 h-12 border-8 border-[var(--led-green)] border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-8 font-mono text-[var(--led-green)] animate-pulse text-lg font-black tracking-widest">TRANSMITTING_DATA_CHUNK...</p>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

const ThemeButton: React.FC<{ active: boolean, onClick: () => void, label: string, color: string }> = ({ active, onClick, label, color }) => (
  <button onClick={onClick} className={`p-4 border-4 flex flex-col items-center gap-3 transition-all ${active ? 'border-[var(--accent-orange)] bg-white/10 scale-105 shadow-lg' : 'border-[var(--panel-shadow)] opacity-50 hover:opacity-100'}`}>
     <div className="w-10 h-10 border-2 border-black/30 shadow-sm" style={{ backgroundColor: color }}></div>
     <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
  </button>
);

const SidebarToolButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`w-full flex flex-col items-center justify-center py-3 border-4 transition-all relative ${active ? 'bg-[var(--accent-orange)] border-[var(--border-color)] text-white shadow-none translate-x-1' : 'bg-white border-[var(--border-color)] text-[var(--text-color)] shadow-[4px_0_0_0_var(--panel-shadow)] hover:-translate-y-1'}`}
  >
    {icon}
    <span className="text-[8px] font-black mt-1">{label}</span>
  </button>
);

const ControlDeckButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center py-3 border-2 transition-all ${active ? 'bg-[var(--accent-orange)] border-[var(--border-color)] text-white translate-y-1 shadow-none' : 'bg-[var(--hardware-beige)] border-[var(--border-color)] text-[var(--text-color)] shadow-[0_4px_0_0_var(--panel-shadow)] active:translate-y-1 active:shadow-none'}`}
  >
    {icon}
    <span className="text-[9px] font-black mt-1">{label}</span>
  </button>
);
