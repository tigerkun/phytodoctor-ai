import React, { useState } from 'react';

interface DidYouKnowCardProps {
  fact: { text: string; expanded: boolean };
}

export const DidYouKnowCard = ({ fact }: DidYouKnowCardProps) => {
  const [expanded, setExpanded] = useState(fact.expanded);

  return (
    <div className="flex-shrink-0 w-[280px] md:w-[280px] p-6 bg-[length:200%_200%] bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.02)] backdrop-blur-md transition-[background-position] duration-1000 ease-in-out [background-position:top] rounded-2xl border border-[rgba(0,0,0,0.05)] hover:-translate-y-2 hover:shadow-xl transition-all duration-300">
      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <div className="flex h-8 w-8 items-center justify-center bg-purple-100 rounded-full flex-shrink-0">
            ❓
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Did you know?</p>
            <p className="text-xs text-muted-foreground">Plant facts</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <p className="text-sm text-foreground leading-relaxed">
            {fact.text}
          </p>
          
          {!expanded && (
            <button 
              onClick={() => setExpanded(true)}
              className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium bg-[length:200%_200%] bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.02)] backdrop-blur-md transition-[background-position] duration-1000 ease-in-out [background-position:top] border border-[rgba(0,0,0,0.1)] rounded hover:bg-[rgba(0,0,0,0.05)] transition-all duration-200"
            >
              Learn More
            </button>
          )}
          
          {expanded && (
            <div className="mt-2 pt-2 border-t border-[rgba(0,0,0,0.05)]">
              <p className="text-xs text-muted-foreground">
                This fact helps you understand your plants better and care for them more effectively.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};