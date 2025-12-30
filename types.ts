
export type ToolType = 'pen' | 'eraser' | 'fill' | 'picker' | 'pan';
export type SymmetryMode = 'none' | 'vertical' | 'horizontal' | 'quad';
export type ThemeType = 'gameboy' | 'cassette' | 'cyberpunk' | 'stealth';
export type Language = 'zh' | 'en';

export interface Layer {
  id: string;
  name: string;
  data: (string | null)[]; // null represents transparency
  visible: boolean;
}

export interface PixelArt {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: Layer[];
  updatedAt: number;
  preview?: string; // Base64 preview
}

export interface EditorState {
  currentTool: ToolType;
  currentColor: string;
  canvasSize: number;
}
