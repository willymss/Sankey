import { GoogleGenAI } from "@google/genai";
import { VisualConfig } from "../types";
import { PRESETS } from "../constants";

const parseConfigFromText = (text: string): Partial<VisualConfig> => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Failed to parse JSON from Gemini response", e);
  }
  return {};
};

export const generateConfigChange = async (
  currentConfig: VisualConfig,
  userPrompt: string
): Promise<Partial<VisualConfig>> => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY not set. Returning empty config.");
    return {};
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const presetList = Object.keys(PRESETS).join(', ');

  const systemPrompt = `
    You are a data visualization configuration assistant. 
    Transform a user's request into a JSON object to update the 'VisualConfig'.
    
    You can either return a partial config to override specific fields, 
    OR you can set "presetName" to one of the available presets to apply it in bulk.
    
    Available Presets:
    ${presetList}

    Configuration Schema (VisualConfig):
    {
      presetName?: string; // One of the presets above, or 'Custom'
      
      // Canvas
      backgroundColor: string; // hex code
      
      // Layout
      nodeWidth: number; // 50-300
      nodeHeight: number; // 30-150
      horizontalSpacing: number; // 100-500
      verticalSpacing: number; // 40-150
      
      // Node Styling
      nodeShape: 'rectangle' | 'pill' | 'roundedRect' | 'ellipse' | 'diamond' | 'hexagon' | 'parallelogram';
      cornerRadius: number; // 0-20 (for roundedRect)
      nodeFillType: 'solid' | 'gradient';
      nodeFillOpacity: number; // 0.0 - 1.0
      nodeBorderStyle: 'solid' | 'dashed' | 'dotted' | 'none';
      nodeBorderWidth: number; // 0-10
      useCustomBorderColor: boolean;
      nodeBorderColor: string; // hex
      themeColor: string; // hex
      colors: string[]; // Array of hex strings for category colors
      
      // Text
      fontSize: number; // 8-24
      fontFamily: string;
      textColor: string; // hex
      
      // Badges
      showBadges: boolean;
      badgeTextColor: string; // hex
      
      // Shadows
      nodeShadowEnabled: boolean;
      nodeShadowColor: string; // hex
      nodeShadowOpacity: number; // 0-1
      nodeShadowBlur: number; // 0-20
      nodeShadowOffsetX: number;
      nodeShadowOffsetY: number;

      // Links
      linkStyle: 'solid' | 'dashed' | 'dotted' | 'none';
      linkWidth: number; // 1-10
      linkCurveStyle: 'bezier' | 'step' | 'straight';
      linkColorMode: 'source' | 'target' | 'gradient' | 'custom';
      linkColor: string; // hex (used if mode is 'custom')
      lineOpacity: number; // 0-1
      
      // Markers
      showStartMarker: boolean;
      startMarkerType: 'arrow' | 'circle' | 'square' | 'diamond';
      startMarkerSize: number;
      showEndMarker: boolean;
      endMarkerType: 'arrow' | 'circle' | 'square' | 'diamond';
      endMarkerSize: number;
    }

    Return ONLY the valid JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Current Config: ${JSON.stringify(currentConfig)}\nUser Request: ${userPrompt}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || "{}";
    return parseConfigFromText(text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {};
  }
};
