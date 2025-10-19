// Map file extensions to language identifiers for syntax highlighting
export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const extensionMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'mjs': 'javascript',
    'cjs': 'javascript',

    // Web
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',

    // Python
    'py': 'python',
    'pyw': 'python',
    'pyx': 'python',

    // Java/JVM
    'java': 'java',
    'kt': 'kotlin',
    'kts': 'kotlin',
    'scala': 'scala',
    'groovy': 'groovy',

    // C/C++
    'c': 'c',
    'h': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'hpp': 'cpp',
    'hh': 'cpp',

    // C#
    'cs': 'csharp',

    // Go
    'go': 'go',

    // Rust
    'rs': 'rust',

    // Ruby
    'rb': 'ruby',

    // PHP
    'php': 'php',

    // Shell
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',

    // Config/Data
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',

    // Markdown
    'md': 'markdown',
    'mdx': 'markdown',

    // SQL
    'sql': 'sql',

    // Others
    'swift': 'swift',
    'r': 'r',
    'lua': 'lua',
    'perl': 'perl',
    'dart': 'dart',
    'graphql': 'graphql',
    'dockerfile': 'dockerfile',
  };

  // Special case for Dockerfile
  if (filename.toLowerCase() === 'dockerfile' || filename.toLowerCase().startsWith('dockerfile.')) {
    return 'dockerfile';
  }

  return extensionMap[ext || ''] || 'text';
}
