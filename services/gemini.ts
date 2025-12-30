
import { GoogleGenAI, Type } from "@google/genai";

// Initialize with a named parameter as required. The API key must be accessed directly from process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAIInspiration = async (theme?: string): Promise<{ idea: string, palette: string[] }> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: theme ? `Give me a pixel art idea based on ${theme}. Return JSON.` : "Give me a creative pixel art idea for a beginner. Return JSON.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          idea: { type: Type.STRING, description: "A short, catchy drawing idea." },
          palette: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "A list of 5 hex color codes that fit the idea."
          }
        },
        required: ["idea", "palette"]
      }
    }
  });

  // Access the extracted string output using the .text property (not a method).
  const text = response.text;
  return JSON.parse(text || '{}');
};
