
import { GoogleGenAI } from "@google/genai";

// Fix: Always use new GoogleGenAI({ apiKey: process.env.API_KEY }) right before making a call.
export async function executeCode(code: string, language: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Fix: Use gemini-3-pro-preview for coding/logic tasks.
      contents: `Execute the following ${language} code as a terminal emulator. 
      Return only the stdout/stderr. No markdown, no explanations. 
      If there is a syntax error, show it exactly as the compiler would.
      
      Code:
      ${code}`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.1
      }
    });

    // Fix: Access response.text as a property.
    return response.text?.trim() || "Execution finished (no output).";
  } catch (error) {
    console.error("Execution error:", error);
    return "Error: Compiler unreachable. Check your internet or API key.";
  }
}

export async function explainCode(code: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Fix: Use gemini-3-pro-preview for coding analysis.
      contents: `Explain this code briefly for a junior developer. Highlight potential bugs and optimizations.
      
      Code:
      ${code}`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    // Fix: Access response.text as a property.
    return response.text || "No analysis available.";
  } catch (error) {
    console.error("AI Analysis error:", error);
    return "Error: AI Tutor unavailable.";
  }
}
