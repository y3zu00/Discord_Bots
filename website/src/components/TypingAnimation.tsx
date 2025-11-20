import React, { useState, useEffect } from 'react';

interface TypingAnimationProps {
  text: string;
  speed?: number;
  className?: string;
  highlightWord?: string;
  highlightClassName?: string;
}

const TypingAnimation: React.FC<TypingAnimationProps> = ({ 
  text, 
  speed = 100, 
  className = "",
  highlightWord = "",
  highlightClassName = ""
}) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed]);

  const renderText = () => {
    if (!highlightWord || !displayText.includes(highlightWord)) {
      return <span className={className}>{displayText}</span>;
    }

    const parts = displayText.split(highlightWord);
    return (
      <span className={className}>
        {parts[0]}
        <span className={highlightClassName}>{highlightWord}</span>
        {parts[1]}
      </span>
    );
  };

  return renderText();
};

export default TypingAnimation;
