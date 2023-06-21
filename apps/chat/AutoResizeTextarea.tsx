import { useEffect, useRef } from 'react';
import * as React from 'react';

interface AutoResizeTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  value,
  onChange,
  placeholder,
  onKeyDown,
}) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "inherit";
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textAreaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="resize-none border rounded-lg p-2 mb-2"
      placeholder={placeholder}
      rows={1}
      onKeyDown={onKeyDown}
    />
  );
};

export default AutoResizeTextarea;
