
import { PixelArt, Layer } from '../types';

const STORAGE_KEY = 'pixel_monkey_arts';

export const saveArt = (art: PixelArt): void => {
  const arts = getAllArts();
  const index = arts.findIndex(a => a.id === art.id);
  if (index >= 0) {
    arts[index] = { ...art, updatedAt: Date.now() };
  } else {
    arts.push({ ...art, updatedAt: Date.now() });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arts));
};

export const getAllArts = (): PixelArt[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  
  const arts: any[] = JSON.parse(data);
  
  // Migration for legacy single-layer data
  return arts.map(art => {
    if (art.data && !art.layers) {
      const migratedArt: PixelArt = {
        id: art.id,
        name: art.name,
        width: art.width,
        height: art.height,
        layers: [{
          id: 'layer-1',
          name: 'Layer 1',
          data: art.data,
          visible: true
        }],
        updatedAt: art.updatedAt,
        preview: art.preview
      };
      return migratedArt;
    }
    return art as PixelArt;
  });
};

export const getArtById = (id: string): PixelArt | undefined => {
  return getAllArts().find(a => a.id === id);
};

export const deleteArt = (id: string): void => {
  const arts = getAllArts().filter(a => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arts));
};

export const createNewArt = (name: string, size: number): PixelArt => {
  const id = Math.random().toString(36).substring(7);
  const newArt: PixelArt = {
    id,
    name,
    width: size,
    height: size,
    layers: [{
      id: 'layer-1',
      name: 'Layer 1',
      data: Array(size * size).fill(null), // Start transparent
      visible: true
    }],
    updatedAt: Date.now(),
  };
  // Pre-fill bottom layer if needed or keep it transparent
  // For better UX, let's make the first layer white by default or just transparent
  saveArt(newArt);
  return newArt;
};
