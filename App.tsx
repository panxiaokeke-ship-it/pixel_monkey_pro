
import React, { useState, useEffect } from 'react';
import { Gallery } from './components/Gallery';
import { Editor } from './components/Editor';
import { PixelArt, ThemeType } from './types';

const App: React.FC = () => {
  const [currentArt, setCurrentArt] = useState<PixelArt | null>(null);
  const [theme, setTheme] = useState<ThemeType>(() => {
    return (localStorage.getItem('pixel_monkey_theme') as ThemeType) || 'gameboy';
  });

  useEffect(() => {
    document.body.className = `overflow-hidden theme-${theme}`;
    localStorage.setItem('pixel_monkey_theme', theme);
  }, [theme]);

  const handleSetTheme = (newTheme: ThemeType) => {
    setTheme(newTheme);
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[var(--bg-color)] overflow-hidden">
      <div className="h-full w-full md:max-w-4xl lg:max-w-6xl md:aspect-[3/4] lg:aspect-video relative overflow-hidden bg-[var(--bg-color)] md:shadow-[0_0_100px_rgba(0,0,0,0.5)] md:border-x-8 md:border-[var(--border-color)] theme-transition">
        {!currentArt ? (
          <Gallery onSelect={setCurrentArt} />
        ) : (
          <Editor 
            art={currentArt} 
            onBack={() => setCurrentArt(null)} 
            currentTheme={theme}
            onSetTheme={handleSetTheme}
          />
        )}
      </div>
    </div>
  );
};

export default App;
