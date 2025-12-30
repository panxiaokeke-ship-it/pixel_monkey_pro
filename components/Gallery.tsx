
import React, { useState, useEffect } from 'react';
import { PixelArt } from '../types';
import { getAllArts, createNewArt, deleteArt } from '../services/storage';
import { Plus, Trash2, Database, Monitor, Cpu, Sparkles } from 'lucide-react';

interface GalleryProps {
  onSelect: (art: PixelArt) => void;
}

export const Gallery: React.FC<GalleryProps> = ({ onSelect }) => {
  const [arts, setArts] = useState<PixelArt[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newArtName, setNewArtName] = useState('');
  const [newSize, setNewSize] = useState(16);

  useEffect(() => {
    setArts(getAllArts().sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  const handleCreate = () => {
    if (!newArtName.trim()) return;
    const art = createNewArt(newArtName, newSize);
    onSelect(art);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确认抹除此数据单元？')) {
      deleteArt(id);
      setArts(getAllArts().sort((a, b) => b.updatedAt - a.updatedAt));
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-color)] text-[var(--text-color)] relative theme-transition">
      {/* Hardware Top Bar */}
      <header className="p-6 bg-[var(--hardware-beige)] border-b-8 border-[var(--panel-shadow)] flex justify-between items-center text-[var(--text-color)]">
        <div className="relative">
          <h1 className="text-2xl font-black uppercase tracking-tighter leading-none italic">
            Pixel<span className="text-[var(--accent-orange)]">Monkey</span>
          </h1>
          <div className="absolute -bottom-4 left-0">
             <span className="label-tag">Unit: STORAGE_V1.0</span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="status-led text-[var(--led-green)] bg-current"></div>
          <div className="status-led text-gray-400 opacity-20 bg-current"></div>
        </div>
      </header>

      {/* Grid: Looks like a disk rack */}
      <div className="flex-1 overflow-y-auto p-4 pt-12 pb-24 space-y-4">
        <div className="grid grid-cols-1 gap-6">
          {arts.map((art) => (
            <div 
              key={art.id} 
              onClick={() => onSelect(art)}
              className="bg-[var(--hardware-dark)] border-2 border-[var(--border-color)] p-3 flex gap-4 hover:border-[var(--accent-orange)] transition-colors relative group overflow-hidden"
            >
              {/* Fake Magnetic Stripe Design */}
              <div className="absolute top-0 right-0 w-24 h-full bg-white/5 -skew-x-12 translate-x-10 pointer-events-none"></div>
              
              <div className="w-24 h-24 bg-[var(--monitor-bg)] border-2 border-[var(--border-color)] shrink-0 relative flex items-center justify-center overflow-hidden">
                {art.preview ? (
                  <img src={art.preview} alt={art.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <Database className="text-[var(--text-color)] opacity-40" size={32} />
                )}
                {/* Preview Scanline */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--led-green)] opacity-10 to-transparent h-4 w-full animate-bounce"></div>
              </div>

              <div className="flex-1 flex flex-col justify-between py-1">
                <div>
                  <div className="flex justify-between">
                    <h3 className="text-sm font-bold text-[var(--accent-orange)] uppercase truncate">ID: {art.name}</h3>
                    <button onClick={(e) => handleDelete(e, art.id)} className="text-red-500/50 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-[10px] opacity-60 font-mono mt-1">SECTOR: {art.width}x{art.height}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-black/30 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--accent-blue)] w-3/4"></div>
                  </div>
                  <span className="text-[8px] font-mono text-[var(--accent-blue)]">LOADED</span>
                </div>
              </div>
            </div>
          ))}

          {arts.length === 0 && (
            <div className="py-20 flex flex-col items-center opacity-30 italic">
              <Monitor size={48} className="mb-4" />
              <p className="text-sm">NO DATA FOUND IN DRIVE A:</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons Container */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/20 to-transparent pointer-events-none">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full p-4 flex items-center justify-center gap-3 font-black uppercase text-xl pointer-events-auto bg-[var(--accent-orange)] text-white border-2 border-[var(--border-color)] shadow-[4px_4px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
        >
          <Plus size={28} strokeWidth={4} />
          <span>初始化新单元</span>
        </button>
      </div>

      {/* Modal: Styled as System Prompt */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-6 z-[200]">
          <div className="bg-[var(--hardware-beige)] w-full max-w-sm border-4 border-[var(--border-color)] p-6 text-[var(--text-color)]">
            <div className="flex items-center gap-2 mb-6 border-b-2 border-[var(--panel-shadow)] pb-2">
              <Cpu size={20} />
              <h2 className="text-lg font-bold uppercase tracking-tight">Format System Art</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1">Unit Label</label>
                <input 
                  type="text" 
                  value={newArtName}
                  onChange={(e) => setNewArtName(e.target.value)}
                  placeholder="UNTITLED_DATA"
                  className="w-full bg-[var(--monitor-bg)] border-2 border-[var(--panel-shadow)] p-3 text-[var(--led-green)] font-mono outline-none focus:border-[var(--accent-orange)]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1">Grid Resolution</label>
                <div className="grid grid-cols-4 gap-2">
                  {[8, 16, 32, 64].map(s => (
                    <button 
                      key={s}
                      onClick={() => setNewSize(s)}
                      className={`p-2 border-2 font-mono text-xs transition-all ${newSize === s ? 'bg-[var(--accent-orange)] border-[var(--border-color)] text-white' : 'bg-[var(--hardware-dark)] border-[var(--panel-shadow)] text-[var(--text-color)] opacity-60'}`}
                    >
                      {s}x{s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 p-3 border-2 border-[var(--border-color)] text-xs font-bold uppercase">CANCEL</button>
                <button onClick={handleCreate} className="flex-1 bg-[var(--accent-orange)] p-3 border-2 border-[var(--border-color)] text-white font-black uppercase">CONFIRM</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
