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
      {/* 
        Responsive Container: 
        - Occupies full width and height to eliminate "dead zones" on desktop and tablets.
      */}
      <div className="h-full w-full relative overflow-hidden bg-[var(--bg-color)] md:border-x-4 lg:border-x-8 border-[var(--border-color)] theme-transition">
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