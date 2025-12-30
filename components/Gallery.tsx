
import React, { useState, useEffect } from 'react';
import { PixelArt } from '../types';
import { getAllArts, createNewArt, deleteArt } from '../services/storage';
import { Plus, Trash2, Database, Monitor, Cpu } from 'lucide-react';

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
      <header className="p-6 md:p-8 bg-[var(--hardware-beige)] border-b-8 border-[var(--panel-shadow)] flex justify-between items-center text-[var(--text-color)] z-50">
        <div className="relative">
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none italic">
            Pixel<span className="text-[var(--accent-orange)]">Monkey</span>
          </h1>
          <div className="absolute -bottom-5 md:-bottom-6 left-0">
             <span className="label-tag">Unit: STORAGE_V1.1_STABLE</span>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="status-led text-green-500 bg-current"></div>
          <div className="status-led text-yellow-500 bg-current animate-pulse"></div>
          <div className="hidden md:block status-led text-blue-500 bg-current"></div>
        </div>
      </header>

      {/* Grid: Looks like a disk rack */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-12 md:pt-16 pb-24 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {arts.map((art) => (
            <div 
              key={art.id} 
              onClick={() => onSelect(art)}
              className="bg-[var(--hardware-dark)] border-4 border-[var(--border-color)] p-4 flex gap-4 hover:border-[var(--accent-orange)] cursor-pointer transition-all hover:scale-[1.02] active:scale-95 relative group overflow-hidden shadow-lg"
            >
              {/* Fake Magnetic Stripe Design */}
              <div className="absolute top-0 right-0 w-24 h-full bg-white/5 -skew-x-12 translate-x-10 pointer-events-none"></div>
              
              <div className="w-20 h-20 md:w-24 md:h-24 bg-[var(--monitor-bg)] border-2 border-[var(--border-color)] shrink-0 relative flex items-center justify-center overflow-hidden">
                {art.preview ? (
                  <img src={art.preview} alt={art.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <Database className="text-[var(--text-color)] opacity-60" size={32} />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--led-green)] opacity-5 to-transparent h-4 w-full animate-bounce"></div>
              </div>

              <div className="flex-1 flex flex-col justify-between py-1 overflow-hidden">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs md:text-sm font-black text-white uppercase truncate pr-2">ID: {art.name}</h3>
                    <button onClick={(e) => handleDelete(e, art.id)} className="text-red-500 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-[9px] md:text-[10px] text-[var(--led-green)] font-mono mt-1 opacity-80">SECTOR: {art.width}x{art.height}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/10">
                    <div className="h-full bg-[var(--accent-orange)] w-full"></div>
                  </div>
                  <span className="text-[8px] font-black font-mono text-white/70">READ_OK</span>
                </div>
              </div>
            </div>
          ))}

          {arts.length === 0 && (
            <div className="py-20 col-span-full flex flex-col items-center opacity-30 italic">
              <Monitor size={64} className="mb-4" />
              <p className="text-lg font-bold">NO DATA FOUND IN DRIVE A:</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons Container */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-[var(--bg-color)] via-[var(--bg-color)]/80 to-transparent z-40">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full max-w-md mx-auto p-4 md:p-6 flex items-center justify-center gap-3 font-black uppercase text-xl md:text-2xl bg-[var(--accent-orange)] text-white border-4 border-[var(--border-color)] shadow-[6px_6px_0px_var(--border-color)] hover:shadow-[2px_2px_0px_var(--border-color)] hover:translate-x-[4px] hover:translate-y-[4px] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-all"
        >
          <Plus size={32} strokeWidth={4} />
          <span>初始化新单元</span>
        </button>
      </div>

      {/* Modal: Styled as System Prompt */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-[200]">
          <div className="bg-[var(--hardware-beige)] w-full max-w-sm md:max-w-md border-8 border-[var(--border-color)] p-8 text-[var(--text-color)] shadow-[20px_20px_0px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3 mb-8 border-b-4 border-[var(--panel-shadow)] pb-4">
              <Cpu size={24} className="text-[var(--accent-orange)]" />
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Format System Art</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] md:text-xs font-black uppercase mb-2">Unit Label</label>
                <input 
                  type="text" 
                  value={newArtName}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  onChange={(e) => setNewArtName(e.target.value)}
                  placeholder="UNTITLED_DATA"
                  className="w-full bg-[var(--monitor-bg)] border-4 border-[var(--panel-shadow)] p-4 text-[var(--text-color)] font-black font-mono outline-none focus:border-[var(--accent-orange)] text-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] md:text-xs font-black uppercase mb-2">Grid Resolution</label>
                <div className="grid grid-cols-4 gap-3">
                  {[8, 16, 32, 64].map(s => (
                    <button 
                      key={s}
                      onClick={() => setNewSize(s)}
                      className={`p-3 border-4 font-black font-mono text-sm transition-all ${newSize === s ? 'bg-[var(--accent-orange)] border-[var(--border-color)] text-white' : 'bg-white border-[var(--panel-shadow)] text-[var(--text-color)] opacity-60 hover:opacity-100'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 p-4 border-4 border-[var(--border-color)] font-black uppercase text-sm hover:bg-black/10">CANCEL</button>
                <button onClick={handleCreate} className="flex-1 bg-[var(--accent-orange)] p-4 border-4 border-[var(--border-color)] text-white font-black uppercase text-sm shadow-[4px_4px_0px_var(--border-color)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">CONFIRM</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
