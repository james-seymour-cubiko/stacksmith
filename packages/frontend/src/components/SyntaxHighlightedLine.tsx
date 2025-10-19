import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// Import only commonly used languages to reduce bundle size
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import java from 'react-syntax-highlighter/dist/esm/languages/hljs/java';
import cpp from 'react-syntax-highlighter/dist/esm/languages/hljs/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/hljs/csharp';
import go from 'react-syntax-highlighter/dist/esm/languages/hljs/go';
import rust from 'react-syntax-highlighter/dist/esm/languages/hljs/rust';
import ruby from 'react-syntax-highlighter/dist/esm/languages/hljs/ruby';
import php from 'react-syntax-highlighter/dist/esm/languages/hljs/php';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import yaml from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml';
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml';
import css from 'react-syntax-highlighter/dist/esm/languages/hljs/css';
import scss from 'react-syntax-highlighter/dist/esm/languages/hljs/scss';
import sql from 'react-syntax-highlighter/dist/esm/languages/hljs/sql';
import markdown from 'react-syntax-highlighter/dist/esm/languages/hljs/markdown';
import dockerfile from 'react-syntax-highlighter/dist/esm/languages/hljs/dockerfile';

// Register languages
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('jsx', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('tsx', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('c', cpp);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('ruby', ruby);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('xml', xml);
SyntaxHighlighter.registerLanguage('html', xml);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('scss', scss);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('dockerfile', dockerfile);

// Custom Everforest-compatible theme
const everforestTheme = {
  ...atomOneDark,
  'hljs': {
    display: 'inline',
    background: 'transparent',
    color: '#d3c6aa', // everforest-fg
  },
  'hljs-comment': {
    color: '#859289', // everforest-grey1
    fontStyle: 'italic',
  },
  'hljs-keyword': {
    color: '#e67e80', // everforest-red
  },
  'hljs-string': {
    color: '#a7c080', // everforest-green
  },
  'hljs-number': {
    color: '#d699b6', // everforest-purple
  },
  'hljs-function': {
    color: '#7fbbb3', // everforest-aqua
  },
  'hljs-class': {
    color: '#dbbc7f', // everforest-yellow
  },
  'hljs-title': {
    color: '#dbbc7f', // everforest-yellow
  },
  'hljs-variable': {
    color: '#d3c6aa', // everforest-fg
  },
  'hljs-type': {
    color: '#7fbbb3', // everforest-aqua
  },
  'hljs-attr': {
    color: '#e69875', // everforest-orange
  },
  'hljs-built_in': {
    color: '#83c092', // everforest-blue-green
  },
  'hljs-literal': {
    color: '#d699b6', // everforest-purple
  },
};

interface SyntaxHighlightedLineProps {
  code: string;
  language: string;
}

export function SyntaxHighlightedLine({ code, language }: SyntaxHighlightedLineProps) {
  // For plain text or unknown languages, return the code as-is
  if (language === 'text' || !language) {
    return <>{code}</>;
  }

  return (
    <SyntaxHighlighter
      language={language}
      style={everforestTheme}
      customStyle={{
        padding: 0,
        margin: 0,
        background: 'transparent',
        display: 'inline',
      }}
      codeTagProps={{
        style: {
          background: 'transparent',
          fontFamily: 'inherit',
        }
      }}
      PreTag="span"
      CodeTag="span"
    >
      {code}
    </SyntaxHighlighter>
  );
}
