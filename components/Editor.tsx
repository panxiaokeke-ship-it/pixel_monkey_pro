import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PixelArt, Layer, ToolType, SymmetryMode, ThemeType } from '../types';
import { saveArt } from '../services/storage';
import { getAIInspiration } from '../services/gemini';
import { 
  ArrowLeft, Save, Undo2, Redo2, 
  PenTool, Eraser, PaintBucket, Pipette, 
  Download, Zap, Check, Grid3X3,
  ZoomIn, ZoomOut, Maximize, Hand,
  Columns, Rows, Grid2X2, CircleOff, MoreHorizontal, X, Cpu,
  ImageDown, Eye, EyeOff, Plus, Trash2, ArrowUp, ArrowDown, Layers as LayersIcon
} from 'lucide-react';

interface EditorProps {
  art: PixelArt;
  onBack: () => void;
  currentTheme: ThemeType;
  onSetTheme: (theme: ThemeType) => void;
}

const SidebarToolButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`w-full flex flex-col items-center justify-center py-4 border-4 transition-all relative ${active ? 'bg-[var(--accent-orange)] border-white text-white translate-x-1' : 'bg-white border-[var(--border-color)] text-[var(--text-color)] shadow-[2px_2px_0_0_var(--panel-shadow)] hover:bg-black/5'}`}
  >
    {icon}
    <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{label}</span>
  </button>
);

const IconButton: React.FC<{ active?: boolean, onClick: () => void, icon: React.ReactNode, title: string, color?: string }> = ({ active, onClick, icon, title, color = "text-[var(--text-color)]" }) => (
  <button 
    onClick={onClick}
    className={`p-2 transition-all hover:bg-white/20 active:scale-90 relative group ${active ? 'bg-white/30 shadow-inner' : ''} ${color}`}
    title={title}
  >
    {icon}
  </button>
);

const ControlDeckButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center py-3 border-4 transition-all ${active ? 'bg-[var(--accent-orange)] border-white text-white translate-y-0.5 shadow-none' : 'bg-[var(--hardware-beige)] border-[var(--border-color)] text-[var(--text-color)] shadow-[0_3px_0_0_var(--panel-shadow)] active:translate-y-0.5 active:shadow-none'}`}
  >
    {icon}
    <span className="text-[9px] font-black mt-1 tracking-tight">{label}</span>
  </button>
);

const ThemeButton: React.FC<{ active: boolean, onClick: () => void, label: string, color: string }> = ({ active, onClick, label, color }) => (
  <button onClick={onClick} className={`p-4 border-4 flex flex-col items-center gap-2 transition-all ${active ? 'border-[var(--accent-orange)] bg-white/10 scale-105 shadow-md' : 'border-[var(--panel-shadow)] opacity-50 hover:opacity-100'}`}>
     <div className="w-8 h-8 border-2 border-black/30 shadow-inner" style={{ backgroundColor: color }}></div>
     <span className="text-[9px] font-black uppercase">{label}</span>
  </button>
);

export const Editor: React.FC<EditorProps> = ({ art, onBack, currentTheme, onSetTheme }) => {
  const [layers, setLayers] = useState<Layer[]>(art.layers);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [history, setHistory] = useState<Layer[][]>([art.layers]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [currentTool, setCurrentTool] = useState<ToolType>('pen');
  const [currentColor, setCurrentColor] = useState('#ff6b00');
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>('none');
  const [brushSize, setBrushSize] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [showInspiration, setShowInspiration] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showLayersMobile, setShowLayersMobile] = useState(false);
  const [aiTip, setAiTip] = useState<{idea: string, palette: string[]} | null>(null);

  const layersRef = useRef<Layer[]>(layers);
  const activeIndexRef = useRef<number>(activeLayerIndex);
  const isChangedRef = useRef(false);

  useEffect(() => {
    layersRef.current = layers;
    activeIndexRef.current = activeLayerIndex;
  }, [layers, activeLayerIndex]);

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
    layers.forEach(layer => {
      if (!layer.visible) return;
      layer.data.forEach((color, i) => {
        if (!color) return;
        const x = i % art.width;
        const y = Math.floor(i / art.width);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      });
    });
  }, [layers, art.width, art.height]);

  const commitHistory = useCallback((nextLayers: Layer[]) => {
    const nextHist = history.slice(0, historyIndex + 1);
    nextHist.push(JSON.parse(JSON.stringify(nextLayers)));
    if (nextHist.length > 50) nextHist.shift();
    setHistory(nextHist);
    setHistoryIndex(nextHist.length - 1);
    isChangedRef.current = false;
  }, [history, historyIndex]);

  const handleAction = useCallback((index: number, overrideColor?: string) => {
    const activeLayer = layersRef.current[activeIndexRef.current];
    if (!activeLayer || !activeLayer.visible) return;

    if (currentTool === 'picker' && !overrideColor) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const x = index % art.width;
      const y = Math.floor(index / art.width);
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
      setCurrentColor(hex);
      return;
    }

    const currentLayerData = [...activeLayer.data];
    const colorToApply = overrideColor || (currentTool === 'eraser' ? null : currentColor);

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

    let changed = false;

    if (currentTool === 'pen' || currentTool === 'eraser' || overrideColor) {
      const brushIndices = getBrushIndices(index);
      const finalIndices = getSymmetricIndices(brushIndices);
      finalIndices.forEach(i => {
        if (currentLayerData[i] !== colorToApply) {
          currentLayerData[i] = colorToApply as string | null;
          changed = true;
        }
      });
    } else if (currentTool === 'fill') {
      const targetColor = currentLayerData[index];
      if (targetColor === currentColor) return;

      const fill = (idx: number) => {
        const stack = [idx];
        while (stack.length > 0) {
          const curr = stack.pop()!;
          if (currentLayerData[curr] !== targetColor) continue;
          currentLayerData[curr] = currentColor;
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
        if (currentLayerData[startIdx] === targetColor) fill(startIdx);
      });
    }

    if (changed) {
      const nextLayers = [...layersRef.current];
      nextLayers[activeIndexRef.current] = {
        ...nextLayers[activeIndexRef.current],
        data: currentLayerData
      };
      setLayers(nextLayers);
      isChangedRef.current = true;
      
      if (overrideColor) {
        commitHistory(nextLayers);
      }
    }
  }, [currentTool, currentColor, art.width, art.height, symmetryMode, brushSize, commitHistory]);

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

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 20));
  };

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

  const stopDragging = () => {
    if (isDraggingRef.current) {
      if (isChangedRef.current) {
        commitHistory(layersRef.current);
      }
      if (currentTool === 'picker') {
        setCurrentTool('pen');
      }
    }
    isDraggingRef.current = false;
  };

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      const state = JSON.parse(JSON.stringify(history[nextIdx]));
      setHistoryIndex(nextIdx);
      setLayers(state);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      const state = JSON.parse(JSON.stringify(history[nextIdx]));
      setHistoryIndex(nextIdx);
      setLayers(state);
    }
  }, [history, historyIndex]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preview = canvas.toDataURL();
    saveArt({ ...art, layers, preview });
    setTimeout(() => setIsSaving(false), 800);
  }, [art, layers]);

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${art.name}_export.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const addLayer = () => {
    const newLayer: Layer = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Layer ${layers.length + 1}`,
      data: Array(art.width * art.height).fill(null),
      visible: true
    };
    const nextLayers = [...layers, newLayer];
    setLayers(nextLayers);
    setActiveLayerIndex(nextLayers.length - 1);
    commitHistory(nextLayers);
  };

  const deleteLayer = (index: number) => {
    if (layers.length <= 1) return;
    const nextLayers = layers.filter((_, i) => i !== index);
    setLayers(nextLayers);
    setActiveLayerIndex(Math.max(0, index - 1));
    commitHistory(nextLayers);
  };

  const toggleLayerVisibility = (index: number) => {
    const nextLayers = [...layers];
    nextLayers[index].visible = !nextLayers[index].visible;
    setLayers(nextLayers);
    commitHistory(nextLayers);
  };

  const moveLayer = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === layers.length - 1) return;
    if (direction === 'down' && index === 0) return;
    const newIndex = direction === 'up' ? index + 1 : index - 1;
    const nextLayers = [...layers];
    [nextLayers[index], nextLayers[newIndex]] = [nextLayers[newIndex], nextLayers[index]];
    setLayers(nextLayers);
    setActiveLayerIndex(newIndex);
    commitHistory(nextLayers);
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

  const getSymmetryIcon = (mode: string, size = 18) => {
    switch (mode) {
      case 'vertical': return <Columns size={size} />;
      case 'horizontal': return <Rows size={size} />;
      case 'quad': return <Grid2X2 size={size} />;
      default: return <CircleOff size={size} />;
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg-color)] text-[var(--text-color)] theme-transition select-none overflow-hidden">
      
      {/* 桌面端左侧工具栏 (Sidebar Tool Left) */}
      <div className="hidden md:flex flex-col w-16 lg:w-24 bg-[var(--hardware-beige)] border-r-4 border-[var(--panel-shadow)] p-2 lg:p-3 items-center gap-4 z-50 shrink-0 shadow-xl">
        <button onClick={onBack} className="cassette-button p-2 lg:p-3 hover:scale-110 transition-all mb-4 mt-2">
          <ArrowLeft size={24} />
        </button>
        <SidebarToolButton active={currentTool === 'pen'} onClick={() => setCurrentTool('pen')} icon={<PenTool size={24} />} label="PEN" />
        <SidebarToolButton active={currentTool === 'eraser'} onClick={() => setCurrentTool('eraser')} icon={<Eraser size={24} />} label="DEL" />
        <SidebarToolButton active={currentTool === 'fill'} onClick={() => setCurrentTool('fill')} icon={<PaintBucket size={24} />} label="FILL" />
        <SidebarToolButton active={currentTool === 'picker'} onClick={() => setCurrentTool('picker')} icon={<Pipette size={24} />} label="PICK" />
        <SidebarToolButton active={currentTool === 'pan'} onClick={() => setCurrentTool('pan')} icon={<Hand size={24} />} label="PAN" />
        
        <div className="mt-auto flex flex-col gap-3 pb-4">
          <button onClick={() => setShowSettings(true)} className="p-3 border-2 border-[var(--border-color)] bg-[var(--hardware-beige)] hover:bg-black/10 transition-all rounded-sm shadow-[2px_2px_0_0_black]"><MoreHorizontal size={24} /></button>
        </div>
      </div>

      {/* 中间主内容区 (Middle Canvas Area) */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        {/* 顶部标题栏 */}
        <header className="p-3 lg:p-4 bg-[var(--hardware-beige)] border-b-4 border-[var(--panel-shadow)] flex justify-between items-center text-[var(--text-color)] z-40 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="md:hidden cassette-button p-1">
              <ArrowLeft size={24} />
            </button>
            <div className="flex flex-col md:flex-row md:items-baseline md:gap-4">
              <h2 className="font-black italic uppercase text-sm lg:text-xl truncate max-w-[150px] lg:max-w-none tracking-tight">{art.name}</h2>
              <span className="hidden sm:inline-block label-tag !text-[8px] lg:!text-[10px]">RES: {art.width}x{art.height}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="hidden md:flex gap-3 mr-2 border-r-2 border-[var(--panel-shadow)] pr-4">
               <button onClick={undo} disabled={historyIndex === 0} className="cassette-button px-4 py-1 text-[10px] font-black disabled:opacity-30">UNDO</button>
               <button onClick={redo} disabled={historyIndex === history.length - 1} className="cassette-button px-4 py-1 text-[10px] font-black disabled:opacity-30">REDO</button>
            </div>
            <button onClick={() => setShowLayersMobile(true)} className="md:hidden cassette-button p-2">
              <LayersIcon size={20} />
            </button>
            <button onClick={() => setShowSettings(true)} className="cassette-button p-2">
              <MoreHorizontal size={20} />
            </button>
          </div>
        </header>

        {/* 画布操作快捷栏 (Compact Toolbar) */}
        <div className="bg-[var(--hardware-beige)]/60 backdrop-blur-md border-b-2 border-[var(--border-color)] p-1.5 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar z-30 shrink-0">
          <div className="flex bg-black/10 p-1 border-2 border-[var(--border-color)] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)]">
            <IconButton onClick={() => setZoom(prev => Math.min(prev * 1.2, 20))} icon={<ZoomIn size={18} />} title="Zoom In" />
            <IconButton onClick={() => setZoom(prev => Math.max(prev * 0.8, 0.5))} icon={<ZoomOut size={18} />} title="Zoom Out" />
            <IconButton onClick={resetZoom} icon={<Maximize size={18} />} title="Reset Zoom" />
          </div>

          <div className="h-6 w-px bg-[var(--panel-shadow)] mx-1"></div>

          <div className="flex bg-black/10 p-1 border-2 border-[var(--border-color)]">
            <IconButton active={showGrid} onClick={() => setShowGrid(!showGrid)} icon={<Grid3X3 size={18} />} title="Grid" />
            <IconButton active={symmetryMode !== 'none'} onClick={cycleSymmetry} icon={getSymmetryIcon(symmetryMode, 18)} title="Symmetry" />
            <IconButton onClick={() => { setShowInspiration(true); getAIInspiration().then(setAiTip); }} icon={<Zap size={18} fill={aiTip ? "currentColor" : "none"} />} title="AI Tips" color="text-yellow-500" />
          </div>

          <div className="h-6 w-px bg-[var(--panel-shadow)] mx-1"></div>

          <div className="flex bg-black/10 p-1 border-2 border-[var(--border-color)]">
            <IconButton onClick={handleSave} icon={<Download size={18} />} title="Save" color="text-blue-500" />
            <IconButton onClick={handleExportPNG} icon={<ImageDown size={18} />} title="Export" color="text-orange-500" />
          </div>
        </div>

        {/* 画布主视口 (Viewport) - 现在自适应剩余空间 */}
        <div 
          ref={viewportRef}
          className="flex-1 bg-[var(--monitor-bg)] flex items-center justify-center p-4 lg:p-8 relative overflow-hidden touch-none"
          onWheel={handleWheel}
          onMouseDown={startDragging}
          onMouseMove={onDrag}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
          onTouchStart={startDragging}
          onTouchMove={onDrag}
          onTouchEnd={stopDragging}
        >
          {/* CRT 纹理装饰 */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(var(--led-green) 1px, transparent 1px), linear-gradient(90deg, var(--led-green) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          
          <div 
            className="relative p-2 lg:p-4 bg-[var(--hardware-beige)] border-4 border-[var(--border-color)] rounded-sm shadow-[0_0_80px_rgba(0,0,0,0.6)] transition-transform duration-75 ease-out"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
             <canvas 
              ref={canvasRef}
              width={art.width}
              height={art.height}
              className="w-[85vw] md:w-auto md:h-full md:max-h-[70vh] aspect-square bg-white pointer-events-none shadow-sm"
            />
            {symmetryMode !== 'none' && (
              <div className="absolute inset-2 lg:inset-4 pointer-events-none z-30 opacity-40">
                {(symmetryMode === 'vertical' || symmetryMode === 'quad') && <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-[var(--accent-orange)] -translate-x-1/2"></div>}
                {(symmetryMode === 'horizontal' || symmetryMode === 'quad') && <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-[var(--accent-orange)] -translate-y-1/2"></div>}
              </div>
            )}
            {showGrid && (
              <div className="absolute inset-2 lg:inset-4 pointer-events-none z-20" style={{ backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.2) 1px, transparent 1px)`, backgroundSize: `${100 / art.width}% ${100 / art.height}%` }} />
            )}
          </div>

          <div className="absolute bottom-4 left-6 font-mono text-[9px] text-[var(--led-green)] font-black opacity-80 drop-shadow-[0_2px_4px_black] bg-black/40 p-2 border-l-4 border-[var(--led-green)] hidden lg:block">
            <p className="tracking-widest opacity-60">SYSTEM_FEED</p>
            <p>X_RES: {art.width}PX</p>
            <p>MAG: {Math.round(zoom * 100)}%</p>
            <p>MOD: {symmetryMode.toUpperCase()}</p>
          </div>
        </div>

        {/* 移动端底部控制面板 (Mobile Only) */}
        <div className="md:hidden bg-[var(--hardware-beige)] border-t-8 border-[var(--panel-shadow)] p-4 safe-bottom text-[var(--text-color)] z-[100]">
          <div className="flex items-center gap-4 mb-4">
             <div className="flex-1 flex gap-2">
                <button onClick={undo} disabled={historyIndex === 0} className="cassette-button flex-1 py-3 font-black text-[10px] disabled:opacity-30 flex items-center justify-center gap-1 uppercase">
                  <Undo2 size={14} /> Undo
                </button>
                <button onClick={redo} disabled={historyIndex === history.length - 1} className="cassette-button flex-1 py-3 font-black text-[10px] disabled:opacity-30 flex items-center justify-center gap-1 uppercase">
                  Redo <Redo2 size={14} />
                </button>
             </div>
             
             <div 
                className="flex items-center gap-2 bg-[var(--hardware-dark)] p-2 border-4 border-[var(--border-color)] active:scale-95 cursor-pointer shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]"
                onClick={() => (document.querySelector('input[type="color"]') as HTMLInputElement)?.click()}
             >
                <div className="w-8 h-8 shrink-0 border-2 border-white" style={{ backgroundColor: currentColor }}></div>
                <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} className="w-0 h-0 opacity-0 absolute pointer-events-none" />
                <span className="font-mono text-[10px] text-[var(--led-green)] font-black">{currentColor.toUpperCase()}</span>
             </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
            {(aiTip?.palette || defaultPalette).map((c, i) => (
              <button 
                key={i} 
                onClick={() => setCurrentColor(c)} 
                className={`w-10 h-10 shrink-0 border-4 transition-all ${currentColor === c ? 'border-white scale-110 z-10 shadow-lg' : 'border-[var(--border-color)]'}`} 
                style={{ backgroundColor: c }} 
              />
            ))}
          </div>

          <div className="flex justify-between gap-1.5 border-t-4 border-[var(--panel-shadow)] pt-4">
            <ControlDeckButton active={currentTool === 'pen'} onClick={() => setCurrentTool('pen')} icon={<PenTool size={22} />} label="PEN" />
            <ControlDeckButton active={currentTool === 'eraser'} onClick={() => setCurrentTool('eraser')} icon={<Eraser size={22} />} label="DEL" />
            <ControlDeckButton active={currentTool === 'fill'} onClick={() => setCurrentTool('fill')} icon={<PaintBucket size={22} />} label="FILL" />
            <ControlDeckButton active={currentTool === 'picker'} onClick={() => setCurrentTool('picker')} icon={<Pipette size={22} />} label="PICK" />
            <ControlDeckButton active={currentTool === 'pan'} onClick={() => setCurrentTool('pan')} icon={<Hand size={22} />} label="PAN" />
          </div>
        </div>
      </div>

      {/* 桌面端右侧常驻面板 (Desktop Panels Right) */}
      <div className="hidden md:flex flex-col w-64 lg:w-80 bg-[var(--hardware-beige)] border-l-4 border-[var(--panel-shadow)] h-full p-4 lg:p-6 z-40 shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] relative overflow-y-auto">
           {/* 装饰细节 */}
           <div className="absolute top-0 right-6 w-12 h-4 border-x-2 border-b-2 border-black/10 flex items-center justify-around px-1">
             <div className="w-1 h-1 rounded-full bg-black/20"></div>
             <div className="w-1 h-1 rounded-full bg-black/20"></div>
           </div>

           <div className="mb-8 mt-4">
              <label className="block text-[10px] font-black uppercase mb-3 tracking-[0.2em] text-[var(--panel-shadow)]">ACTIVE_COLOR</label>
              <div 
                className="w-full aspect-video border-4 border-[var(--border-color)] shadow-[inset_2px_4px_12px_rgba(0,0,0,0.4)] relative flex items-center justify-center group cursor-pointer mb-6"
                style={{ backgroundColor: currentColor }}
                onClick={() => (document.querySelector('input[type="color"]') as HTMLInputElement)?.click()}
              >
                 <div className="bg-black/80 px-4 py-2 font-mono text-white text-[12px] font-black backdrop-blur-sm border-2 border-white/20 group-hover:scale-110 transition-transform">
                    {currentColor.toUpperCase()}
                 </div>
                 <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} className="w-0 h-0 opacity-0 absolute" />
              </div>
              <div className="grid grid-cols-5 gap-2">
                {(aiTip?.palette || defaultPalette).map((c, i) => (
                  <button 
                    key={i} 
                    onClick={() => setCurrentColor(c)} 
                    className={`aspect-square border-2 transition-all ${currentColor === c ? 'border-white scale-110 shadow-xl ring-2 ring-[var(--accent-orange)] z-10' : 'border-[var(--border-color)] hover:scale-105'}`} 
                    style={{ backgroundColor: c }} 
                  />
                ))}
              </div>
           </div>

           <div className="flex-1 flex flex-col min-h-[250px] mb-8 bg-black/5 p-4 border-2 border-[var(--panel-shadow)] shadow-inner">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-black/10">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--panel-shadow)]">DATA_LAYERS</label>
                <button onClick={addLayer} className="p-1.5 bg-[var(--accent-orange)] text-white border-2 border-[var(--border-color)] hover:scale-110 shadow-[2px_2px_0_0_black] transition-all">
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scroll">
                {[...layers].reverse().map((layer, revIdx) => {
                  const index = layers.length - 1 - revIdx;
                  const isActive = activeLayerIndex === index;
                  return (
                    <div 
                      key={layer.id} 
                      onClick={() => setActiveLayerIndex(index)}
                      className={`p-2.5 border-2 flex items-center gap-2 transition-all cursor-pointer ${isActive ? 'bg-[var(--accent-orange)] text-white border-white scale-[1.02] shadow-lg' : 'bg-white/60 border-[var(--border-color)] opacity-70 hover:opacity-100 hover:bg-white/90'}`}
                    >
                      <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(index); }} className="p-1 hover:bg-black/10 rounded-sm">
                        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <span className="text-[10px] font-black uppercase truncate flex-1 tracking-tight">{layer.name}</span>
                      <div className="flex flex-col gap-1">
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(index, 'up'); }} className="p-0.5 hover:bg-black/10"><ArrowUp size={10} /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(index, 'down'); }} className="p-0.5 hover:bg-black/10"><ArrowDown size={10} /></button>
                      </div>
                      {layers.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); deleteLayer(index); }} className="p-1 text-red-600 hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
           </div>

           <div className="space-y-6 pt-6 border-t-4 border-[var(--panel-shadow)]">
              <div className="bg-[var(--hardware-dark)] p-4 border-2 border-[var(--border-color)] shadow-inner rounded-sm">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] font-mono">BRUSH_SIZE</span>
                   <span className="text-[10px] font-black text-[var(--led-green)] font-mono">{brushSize}PX</span>
                </div>
                <input 
                  type="range" min="1" max="10" value={brushSize} 
                  onChange={(e) => setBrushSize(parseInt(e.target.value))} 
                  className="w-full accent-[var(--accent-orange)] h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
              </div>

              <button onClick={handleSave} className="w-full bg-[var(--accent-orange)] text-white p-4 font-black uppercase border-4 border-[var(--border-color)] shadow-[4px_4px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-3 text-lg tracking-tighter">
                 {isSaving ? <Check size={24} /> : <Save size={24} />}
                 <span>{isSaving ? 'SAVED' : 'COMMIT'}</span>
              </button>
           </div>
        </div>

      {/* Layer Modal Mobile */}
      {showLayersMobile && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-6 z-[300]">
           <div className="bg-[var(--hardware-beige)] border-4 border-[var(--border-color)] p-6 w-full max-w-sm text-[var(--text-color)]">
              <div className="flex justify-between items-center mb-6 border-b-4 border-[var(--panel-shadow)] pb-2">
                 <h2 className="text-lg font-black uppercase tracking-tight">Layers</h2>
                 <button onClick={() => setShowLayersMobile(false)} className="p-1"><X size={24} /></button>
              </div>
              <div className="space-y-3 mb-6 max-h-[50vh] overflow-y-auto pr-2">
                {[...layers].reverse().map((layer, revIdx) => {
                  const index = layers.length - 1 - revIdx;
                  const isActive = activeLayerIndex === index;
                  return (
                    <div 
                      key={layer.id} 
                      onClick={() => { setActiveLayerIndex(index); setShowLayersMobile(false); }}
                      className={`p-3 border-2 flex items-center gap-3 ${isActive ? 'bg-[var(--accent-orange)] text-white border-white scale-105' : 'bg-white/40 border-[var(--border-color)]'}`}
                    >
                      <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(index); }} className="p-1">
                        {layer.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                      </button>
                      <span className="font-black uppercase text-xs flex-1 truncate">{layer.name}</span>
                      <div className="flex gap-4">
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(index, 'up'); }}><ArrowUp size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(index, 'down'); }}><ArrowDown size={18} /></button>
                        {layers.length > 1 && (
                          <button onClick={(e) => { e.stopPropagation(); deleteLayer(index); }} className="text-red-500"><Trash2 size={18} /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={addLayer} className="w-full bg-[var(--accent-orange)] text-white p-4 border-2 border-[var(--border-color)] font-black uppercase shadow-[4px_4px_0_0_black]">NEW LAYER</button>
           </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-[400]">
           <div className="bg-[var(--hardware-beige)] border-8 border-[var(--border-color)] p-10 w-full max-w-md text-[var(--text-color)] shadow-[20px_20px_0px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-center mb-8 border-b-8 border-[var(--panel-shadow)] pb-4">
                 <div className="flex items-center gap-4">
                    <Cpu size={32} className="text-[var(--accent-orange)]" />
                    <h2 className="text-2xl font-black uppercase tracking-tight">CONFIG</h2>
                 </div>
                 <button onClick={() => setShowSettings(false)} className="p-2"><X size={36} /></button>
              </div>

              <div className="space-y-8">
                 <div>
                    <label className="block text-[10px] font-black uppercase mb-4 tracking-widest text-[var(--panel-shadow)]">VISUAL_PROFILE</label>
                    <div className="grid grid-cols-2 gap-4">
                       <ThemeButton active={currentTheme === 'gameboy'} onClick={() => onSetTheme('gameboy')} label="DMG-01" color="#8bac0f" />
                       <ThemeButton active={currentTheme === 'cassette'} onClick={() => onSetTheme('cassette')} label="Mk-II" color="#ff6b00" />
                       <ThemeButton active={currentTheme === 'cyberpunk'} onClick={() => onSetTheme('cyberpunk')} label="Neon" color="#ff00ff" />
                       <ThemeButton active={currentTheme === 'stealth'} onClick={() => onSetTheme('stealth')} label="Night" color="#333333" />
                    </div>
                 </div>

                 <div className="pt-6 border-t-8 border-[var(--panel-shadow)]">
                    <button onClick={handleSave} className="w-full bg-[var(--accent-orange)] p-5 border-4 border-[var(--border-color)] text-white font-black uppercase text-xl shadow-[6px_6px_0px_var(--border-color)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-4">
                       {isSaving ? <Check size={28} /> : <Save size={28} />}
                       <span>{isSaving ? 'SAVED' : 'SAVE_ALL'}</span>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* AI Inspiration Overlay */}
      {showInspiration && (
        <div className="fixed inset-0 bg-black/98 flex items-center justify-center p-6 z-[500]">
           <div className="bg-black border-4 border-[var(--led-green)] p-8 lg:p-10 w-full max-w-lg relative shadow-[0_0_60px_var(--led-green)]">
              <div className="absolute -top-6 left-10 label-tag !bg-[var(--led-green)] !text-black !text-xs">NEURAL_LINK_ACTIVE</div>
              {aiTip ? (
                <div className="space-y-10">
                  <div className="font-mono text-lg leading-relaxed text-white">
                    <span className="block text-[10px] text-[var(--led-green)] opacity-70 mb-4 animate-pulse">> IDEA_STREAM:</span>
                    <span className="bg-[var(--led-green)] text-black px-2 py-1 font-black">{aiTip.idea}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--led-green)] opacity-70 mb-4">> SPECTRAL_PALETTE:</span>
                    <div className="grid grid-cols-5 gap-4">
                      {aiTip.palette.map((c, i) => (
                        <button key={i} onClick={() => {setCurrentColor(c); setShowInspiration(false);}} className={`aspect-square border-4 transition-all ${currentColor === c ? 'border-[var(--led-green)] scale-110 shadow-[0_0_20px_var(--led-green)]' : 'border-white/20'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setShowInspiration(false)} className="w-full py-5 border-4 border-[var(--led-green)] text-[var(--led-green)] font-black uppercase text-xl hover:bg-[var(--led-green)] hover:text-black transition-all">DISMISS</button>
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center">
                  <div className="w-14 h-14 border-8 border-[var(--led-green)] border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-10 font-mono text-[var(--led-green)] animate-pulse text-lg font-black tracking-widest uppercase">Fetching...</p>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};
