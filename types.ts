
export type ToolType = 'pen' | 'eraser' | 'fill' | 'picker' | 'pan';
export type SymmetryMode = 'none' | 'vertical' | 'horizontal' | 'quad';
export type ThemeType = 'gameboy' | 'cassette' | 'cyberpunk' | 'stealth';

export interface PixelArt {
  id: string;
  name: string;
  width: number;
  height: number;
  data: string[]; // Flat array of hex colors
  updatedAt: number;
  preview?: string; // Base64 preview
}

export interface EditorState {
  currentTool: ToolType;
  currentColor: string;
  canvasSize: number;
}
