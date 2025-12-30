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

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preview = canvas.toDataURL();
    saveArt({ ...art, layers, preview });
    setTimeout(() => setIsSaving(false), 800);
  }, [art, layers]);

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

  // Keyboard Shortcuts Implementation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      if (key === 'p') setCurrentTool('pen');
      if (key === 'e') setCurrentTool('eraser');
      if (key === 'f') setCurrentTool('fill');
      if (key === 'i') setCurrentTool('picker');
      if (key === ' ') {
        e.preventDefault();
        setCurrentTool('pan');
      }

      if (ctrlOrMeta && key === 'z') {
        e.preventDefault();
        undo();
      } else if ((ctrlOrMeta && key === 'y') || (ctrlOrMeta && e.shiftKey && key === 'z')) {
        e.preventDefault();
        redo();
      } else if (ctrlOrMeta && key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleSave]);

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

  const getSymmetryIcon = (mode: string, size = 20) => {
    switch (mode) {
      case 'vertical': return <Columns size={size} />;
      case 'horizontal': return <Rows size={size} />;
      case 'quad': return <Grid2X2 size={size} />;
      default: return <CircleOff size={size} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[var(--bg-color)] text-[var(--text-color)] theme-transition select-none overflow-hidden">
      
      {/* Sidebar Tool (Left) */}
      <div className="hidden md:flex flex-col w-20 lg:w-24 bg-[var(--hardware-beige)] border-r-8 border-[var(--panel-shadow)] p-3 items-center gap-4 z-50">
        <button onClick={onBack} className="cassette-button p-3 hover:scale-110 transition-all mb-4">
          <ArrowLeft size={24} />
        </button>
        <SidebarToolButton active={currentTool === 'pen'} onClick={() => setCurrentTool('pen')} icon={<PenTool size={28} />} label="PEN (P)" />
        <SidebarToolButton active={currentTool === 'eraser'} onClick={() => setCurrentTool('eraser')} icon={<Eraser size={28} />} label="DEL (E)" />
        <SidebarToolButton active={currentTool === 'fill'} onClick={() => setCurrentTool('fill')} icon={<PaintBucket size={28} />} label="FILL (F)" />
        <SidebarToolButton active={currentTool === 'picker'} onClick={() => setCurrentTool('picker')} icon={<Pipette size={28} />} label="PICK (I)" />
        <SidebarToolButton active={currentTool === 'pan'} onClick={() => setCurrentTool('pan')} icon={<Hand size={28} />} label="PAN (SPC)" />
        <div className="mt-auto flex flex-col gap-3">
          <button onClick={() => setShowSettings(true)} className="p-3 border-2 border-[var(--border-color)] bg-[var(--hardware-beige)] hover:bg-black/10 transition-all rounded-sm shadow-[2px_2px_0_0_black]"><MoreHorizontal size={24} /></button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative">
        {/* Mobile Header */}
        <header className="p-4 md:hidden bg-[var(--hardware-beige)] border-b-4 border-[var(--border-color)] flex justify-between items-center text-[var(--text-color)] z-[100]">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="cassette-button p-1">
              <ArrowLeft size={24} />
            </button>
            <h2 className="font-black italic uppercase text-sm leading-none truncate max-w-[100px]">{art.name}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowLayersMobile(true)} className="cassette-button p-2">
              <LayersIcon size={20} />
            </button>
            <button onClick={() => setShowSettings(true)} className="cassette-button p-2">
              <MoreHorizontal size={20} />
            </button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex p-4 bg-[var(--hardware-beige)] border-b-4 border-[var(--panel-shadow)] justify-between items-center text-[var(--text-color)] z-40">
           <div className="flex items-center gap-4">
              <h2 className="font-black italic uppercase text-xl leading-none">{art.name}</h2>
              <span className="label-tag">Unit: {art.width}x{art.height}</span>
           </div>
           <div className="flex gap-4">
              <button onClick={undo} disabled={historyIndex === 0} className="cassette-button px-6 py-2 text-xs font-black disabled:opacity-30">UNDO (Ctrl+Z)</button>
              <button onClick={redo} disabled={historyIndex === history.length - 1} className="cassette-button px-6 py-2 text-xs font-black disabled:opacity-30">REDO (Ctrl+Y)</button>
           </div>
        </header>

        {/* Canvas Toolbar (New: Above the canvas) */}
        <div className="bg-[var(--hardware-beige)]/50 backdrop-blur-md border-b-2 border-[var(--border-color)] p-2 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar z-30">
          <div className="flex bg-black/10 p-1 border-2 border-[var(--border-color)] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)]">
            <IconButton onClick={() => setZoom(prev => Math.min(prev * 1.2, 20))} icon={<ZoomIn size={18} />} title="Zoom In" />
            <IconButton onClick={() => setZoom(prev => Math.max(prev * 0.8, 0.5))} icon={<ZoomOut size={18} />} title="Zoom Out" />
            <IconButton onClick={resetZoom} icon={<Maximize size={18} />} title="Reset Zoom" />
          </div>

          <div className="h-8 w-px bg-[var(--panel-shadow)] mx-1"></div>

          <div className="flex bg-black/10 p-1 border-2 border-[var(--border-color)]">
            <IconButton active={showGrid} onClick={() => setShowGrid(!showGrid)} icon={<Grid3X3 size={18} />} title="Grid" />
            <IconButton active={symmetryMode !== 'none'} onClick={cycleSymmetry} icon={getSymmetryIcon(symmetryMode, 18)} title="Symmetry" />
            <IconButton onClick={() => { setShowInspiration(true); getAIInspiration().then(setAiTip); }} icon={<Zap size={18} fill={aiTip ? "currentColor" : "none"} />} title="AI Tips" color="text-yellow-500" />
          </div>

          <div className="h-8 w-px bg-[var(--panel-shadow)] mx-1"></div>

          <div className="flex bg-black/10 p-1 border-2 border-[var(--border-color)]">
            <IconButton onClick={handleSave} icon={<Download size={18} />} title="Save (Ctrl+S)" color="text-blue-500" />
            <IconButton onClick={handleExportPNG} icon={<ImageDown size={18} />} title="Export" color="text-orange-500" />
          </div>
        </div>

        {/* Monitor Area */}
        <div 
          ref={viewportRef}
          className="flex-1 bg-[var(--monitor-bg)] flex items-center justify-center p-4 md:p-10 relative overflow-hidden touch-none