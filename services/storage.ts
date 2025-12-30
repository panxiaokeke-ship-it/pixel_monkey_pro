
import { PixelArt } from '../types';

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
  return data ? JSON.parse(data) : [];
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
    data: Array(size * size).fill('#ffffff'),
    updatedAt: Date.now(),
  };
  saveArt(newArt);
  return newArt;
};
