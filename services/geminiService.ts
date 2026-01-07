
import { GoogleGenAI } from "@google/genai";

// Initializing the GenAI client using the required apiKey parameter and process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// executeCode uses GenAI to simulate a terminal environment for code output
export async function executeCode(code: string, language: string) {
  try {
    // Fix: Using 'gemini-3-pro-preview' for complex coding tasks as per model selection guidelines
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `You are a high-fidelity code execution engine simulating a professional IDE terminal.
      Language: ${language}
      Task: Execute the following code and return ONLY the raw stdout and stderr output.
      
      Instructions:
      1. If the code has syntax errors, return the exact error message the compiler or interpreter would provide.
      2. If execution is successful, return the program output exactly as it would appear in a terminal.
      3. DO NOT wrap the output in markdown code blocks.
      4. DO NOT provide explanations, headers, or any conversational text.
      5. DO NOT say "Output:" or "Result:".
      6. For HTML, return "DOM Rendered successfully" and a brief summary of the elements.
      
      Code to execute:
      ${code}`,
      config: {
        // Disabling thinking budget for direct terminal-like response
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    // Accessing text as a property, not a method, as per SDK requirements
    return response.text?.trim() || "Process finished with no output.";
  } catch (error) {
    console.error("Execution error:", error);
    return "Error: The execution environment failed. Please check your code or try again later.";
  }
}

// explainCode provides AI-driven analysis of user code
export async function explainCode(code: string) {
  try {
    // Fix: Using 'gemini-3-pro-preview' for complex text reasoning tasks
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `As an expert coding mentor, provide a concise but deep analysis of this code. 
      Identify potential bugs, logic flaws, and suggest 1-2 modern optimizations.
      
      Code:
      ${code}`,
    });

    // Accessing text as a property
    return response.text || "Unable to analyze code at this time.";
  } catch (error) {
    console.error("Analysis error:", error);
    return "Error: AI Mentor service is currently unavailable.";
  }
}
