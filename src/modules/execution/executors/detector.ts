/**
 * Language Detector
 * 
 * Intelligently detects whether code is Python or Shell
 */

export interface DetectionResult {
  language: 'python' | 'shell';
  confidence: number;
  reason: string;
}

export class LanguageDetector {
  // Common shell commands
  private static shellCommands = new Set([
    'ls', 'cd', 'pwd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'touch',
    'cat', 'echo', 'grep', 'sed', 'awk', 'find', 'chmod', 'chown',
    'tar', 'zip', 'unzip', 'curl', 'wget', 'ssh', 'scp', 'rsync',
    'git', 'npm', 'yarn', 'docker', 'kubectl', 'brew', 'apt', 'yum',
    'ps', 'kill', 'top', 'df', 'du', 'head', 'tail', 'sort', 'uniq',
    'wc', 'diff', 'patch', 'make', 'gcc', 'node', 'python', 'pip',
    'export', 'source', 'alias', 'which', 'type', 'history'
  ]);

  // Shell-specific patterns
  private static shellPatterns = [
    /^\s*#!/,                    // Shebang
    /\|\s*\w+/,                  // Pipes
    />\s*\w+/,                   // Redirects
    /&{1,2}/,                    // Background or &&
    /\${[\w_]+}/,                // Shell variables ${VAR}
    /\$\(/,                      // Command substitution
    /`[^`]+`/,                   // Backticks
    /\[\[.*\]\]/,                // Bash conditionals
    /^\s*if\s+\[/,               // Shell if statements
    /^\s*for\s+\w+\s+in\s+/,     // Shell for loops
    /^\s*while\s+\[/,            // Shell while loops
    /^\s*case\s+/,               // Case statements
    /^\s*function\s+\w+/,        // Function definitions
    /\s+&&\s+/,                  // Command chaining
    /\s+\|\|\s+/,                // Or operator
    /^\s*\w+\s*\(\)\s*{/         // Bash function syntax
  ];

  // Python-specific patterns
  private static pythonPatterns = [
    /^\s*import\s+/m,            // Import statements
    /^\s*from\s+\w+\s+import/m,  // From imports
    /^\s*def\s+\w+\s*\(/m,       // Function definitions
    /^\s*class\s+\w+/m,          // Class definitions
    /^\s*if\s+.*:/m,             // Python if with colon
    /^\s*for\s+\w+\s+in\s+.*:/m, // Python for loops
    /^\s*while\s+.*:/m,          // Python while loops
    /^\s*try:/m,                 // Try blocks
    /^\s*except/m,               // Except blocks
    /\[\w+\s+for\s+\w+\s+in/,    // List comprehensions
    /print\s*\(/,                // Print function
    /^\s*@\w+/m,                 // Decorators
    /__\w+__/,                   // Dunder methods
    /\s+is\s+/,                  // Python 'is' operator
    /\s+in\s+/,                  // Python 'in' operator
    /^\s*elif\s+/m,              // elif statements
    /^\s*lambda\s+/              // Lambda functions
  ];

  static detect(code: string): DetectionResult {
    const trimmed = code.trim();
    const lines = trimmed.split('\n');
    const firstLine = lines[0] || '';
    const firstWord = firstLine.split(/\s+/)[0] || '';

    // Quick wins - single line shell commands
    if (lines.length === 1) {
      // Check if it starts with a known shell command
      if (this.shellCommands.has(firstWord)) {
        return {
          language: 'shell',
          confidence: 0.95,
          reason: `Starts with shell command: ${firstWord}`
        };
      }

      // Check for common shell patterns in single line
      if (firstLine.includes('|') || firstLine.includes('>') || firstLine.includes('&&')) {
        return {
          language: 'shell',
          confidence: 0.9,
          reason: 'Contains shell operators (|, >, &&)'
        };
      }
    }

    // Score-based detection for multi-line code
    let shellScore = 0;
    let pythonScore = 0;

    // Check shell patterns
    for (const pattern of this.shellPatterns) {
      if (pattern.test(code)) {
        shellScore += 1;
      }
    }

    // Check Python patterns
    for (const pattern of this.pythonPatterns) {
      if (pattern.test(code)) {
        pythonScore += 1;
      }
    }

    // Check first words of each line
    for (const line of lines) {
      const lineFirstWord = line.trim().split(/\s+/)[0] || '';
      if (this.shellCommands.has(lineFirstWord)) {
        shellScore += 0.5;
      }
    }

    // Special cases
    if (code.includes('subprocess.') || code.includes('os.system')) {
      // Python code that runs shell commands - still Python
      pythonScore += 2;
    }

    // Determine language based on scores
    if (shellScore > pythonScore) {
      return {
        language: 'shell',
        confidence: Math.min(0.95, shellScore / (shellScore + pythonScore)),
        reason: `Shell patterns detected (score: ${shellScore} vs ${pythonScore})`
      };
    } else if (pythonScore > 0) {
      return {
        language: 'python',
        confidence: Math.min(0.95, pythonScore / (shellScore + pythonScore)),
        reason: `Python patterns detected (score: ${pythonScore} vs ${shellScore})`
      };
    }

    // Default to Python if no clear indicators
    return {
      language: 'python',
      confidence: 0.5,
      reason: 'No clear language indicators, defaulting to Python'
    };
  }
}
