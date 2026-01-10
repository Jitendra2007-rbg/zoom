
/**
 * Real-time Code Execution Service
 * Uses the Piston API (https://emkc.org/api/v2/piston/execute)
 * Support for a wide range of industry languages.
 */

const LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  python: { language: 'python', version: '3.10.0' },
  javascript: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '4.7.4' },
  java: { language: 'java', version: '15.0.2' },
  c: { language: 'c', version: '10.2.1' },
  cpp: { language: 'cpp', version: '10.2.1' },
  rust: { language: 'rust', version: '1.68.2' },
  go: { language: 'go', version: '1.16.2' },
  php: { language: 'php', version: '8.2.3' },
  ruby: { language: 'ruby', version: '3.0.1' },
  react: { language: 'javascript', version: '18.15.0' },
  html: { language: 'javascript', version: '18.15.0' },
  css: { language: 'javascript', version: '18.15.0' }
};

export async function executeCode(code: string, language: string) {
  const langKey = language.toLowerCase();
  const config = LANGUAGE_MAP[langKey] || LANGUAGE_MAP.javascript;

  // Visual languages simulation
  if (['html', 'css'].includes(langKey)) {
    return `Rendering successful. This language does not produce CLI output. Please switch to the Browser Preview tab if available.`;
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
      if (data.run.stderr) return `Error Output:\n${data.run.stderr}`;
      return data.run.output || "Program executed successfully with no output.";
    }
    return data.message || "Execution error: Unexpected response from compiler.";
  } catch (error) {
    console.error("Execution error:", error);
    return "Error: Could not connect to the code execution server.";
  }
}
