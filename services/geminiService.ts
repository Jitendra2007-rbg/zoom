
import { GoogleGenAI } from "@google/genai";

const getAIClient = () => {
  const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : '';
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

export async function executeCode(code: string, language: string) {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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

    return response.text?.trim() || "Execution finished (no output).";
  } catch (error) {
    console.error("Execution error:", error);
    return "Error: Compiler unreachable. Check your internet or API key.";
  }
}

export async function explainCode(code: string) {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Explain this code briefly for a junior developer. Highlight potential bugs and optimizations.
      
      Code:
      ${code}`,
    });

    return response.text || "No analysis available.";
  } catch (error) {
    return "Error: AI Tutor unavailable.";
  }
}
