import React, { useState } from 'react';

interface TreatmentCardProps {
  treatments: Array<{ step: string; done: boolean }>;
}

export const TreatmentCard = ({ treatments }: TreatmentCardProps) => {
  const [localTreatments, setLocalTreatments] = useState(() => treatments);

  const toggleTreatment = (index: number) => {
    setLocalTreatments(prev => 
      prev.map((treatment, i) => 
        i === index ? { ...treatment, done: !treatment.done } : treatment
      )
    );
  };

  const markAllDone = () => {
    setLocalTreatments(prev => prev.map(treatment => ({ ...treatment, done: true })));
  };

  const completedCount = localTreatments.filter(t => t.done).length;
  const totalCount = localTreatments.length;
  const confidence = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="flex-shrink-0 w-[280px] md:w-[280px] p-6 bg-[length:200%_200%] bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.02)] backdrop-blur-md transition-[background-position] duration-1000 ease-in-out [background-position:top] rounded-2xl border border-[rgba(0,0,0,0.05)] hover:-translate-y-2 hover:shadow-xl transition-all duration-300">
      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <div className="flex h-8 w-8 items-center justify-center bg-red-100 rounded-full flex-shrink-0">
            {/* Issue icon - using a droplet for humidity stress */}
            💧
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Early humidity stress detected</p>
            <p className="text-xs text-muted-foreground">Confidence: {confidence}%</p>
          </div>
        </div>
        
        <div className="space-y-3">
          {localTreatments.map((treatment, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex h-4 w-4 items-center justify-center shrink-0">
                <input 
                  type="checkbox" 
                  checked={treatment.done} 
                  onChange={() => toggleTreatment(index)} 
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
              </div>
              <span className="text-sm text-foreground">{treatment.step}</span>
            </div>
          ))}
        </div>
        
        <button 
          onClick={markAllDone}
          className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium bg-[length:200%_200%] bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.02)] backdrop-blur-md transition-[background-position] duration-1000 ease-in-out [background-position:top] border border-[rgba(0,0,0,0.1)] rounded-lg hover:bg-[rgba(0,0,0,0.05)] transition-all duration-200"
        >
          Mark All Done
        </button>
      </div>
    </div>
  );
};