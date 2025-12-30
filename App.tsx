
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
    <div className="h-screen w-full max-w-md mx-auto relative overflow-hidden bg-[var(--bg-color)] shadow-2xl theme-transition">
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
  );
};

export default App;
