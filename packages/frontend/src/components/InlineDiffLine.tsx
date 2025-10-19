import { SyntaxHighlightedLine } from './SyntaxHighlightedLine';

type DiffSegment = { text: string; type: 'equal' | 'delete' | 'insert' };

interface InlineDiffLineProps {
  segments: DiffSegment[];
  language: string;
  isModifiedLine: boolean;
}

export function InlineDiffLine({ segments, language, isModifiedLine }: InlineDiffLineProps) {
  return (
    <>
      {segments.map((segment, index) => {
        const bgClass =
          segment.type === 'delete'
            ? 'bg-everforest-red/55 text-everforest-red'
            : segment.type === 'insert'
            ? 'bg-everforest-green/55 text-everforest-green'
            : '';

        return (
          <span key={index} className={bgClass}>
            <SyntaxHighlightedLine code={segment.text} language={language} />
          </span>
        );
      })}
    </>
  );
}
