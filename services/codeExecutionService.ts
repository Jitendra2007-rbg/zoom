
/**
 * Real-time Code Execution Service
 * Uses the Piston API (https://emkc.org/api/v2/piston/execute)
 * Support for C, Java, Python, Javascript, etc.
 */

const LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  python: { language: 'python', version: '3.10.0' },
  javascript: { language: 'javascript', version: '18.15.0' },
  java: { language: 'java', version: '15.0.2' },
  c: { language: 'c', version: '10.2.1' },
  react: { language: 'javascript', version: '18.15.0' },
  html: { language: 'javascript', version: '18.15.0' } // HTML simulation
};

export async function executeCode(code: string, language: string) {
  const config = LANGUAGE_MAP[language.toLowerCase()] || LANGUAGE_MAP.javascript;

  // Simple HTML/React mock if needed, but Piston handles the rest
  if (language.toLowerCase() === 'html') {
    return "DOM Rendering Simulation: Successful. (HTML doesn't produce stdout, check browser preview if implemented).";
  }

  try {
    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: config.language,
        version: config.version,
        files: [{ content: code }],
      }),
    });

    const data = await response.json();
    if (data.run) {
      return data.run.output || "Program executed successfully with no output.";
    }
    return data.message || "Execution error: Unexpected response from compiler.";
  } catch (error) {
    console.error("Execution error:", error);
    return "Error: Could not connect to the code execution server. Please check your internet connection.";
  }
}
