import React, { useState } from 'react';
import { HealthRing } from './HealthRing';

interface PlantProfileDrawerProps {
  plant: {
    id: string;
    photoUrl: string;
    nickname: string;
    healthScore: number;
    daysSinceWater: number;
    speciesName: string;
  };
  onClose: () => void;
}

export const PlantProfileDrawer = ({ plant, onClose }: PlantProfileDrawerProps) => {
  const [isNicknameEditing, setIsNicknameEditing] = useState(false);
  const [editedNickname, setEditedNickname] = useState(plant.nickname);

  const handleSaveNickname = () => {
    // In a real app, this would update the plant data
    setIsNicknameEditing(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[85vh] bg-[length:200%_200%] bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.02)] backdrop-blur-md transition-[background-position] duration-1000 ease-in-out [background-position:top] border-t border-[rgba(0,0,0,0.05)] transform translate-y-0 transition-transform duration-500 z-50">
      <div className="flex flex-col h-full">
        {/* Handle */}
        <div className="flex items-center justify-center py-2">
          <div className="w-12 h-0.5 bg-muted/50 rounded" />
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Full photo with parallax effect (simplified) */}
          <div className="relative h-64 mb-6 rounded-xl overflow-hidden">
            <img 
              src={plant.photoUrl} 
              alt={plant.nickname} 
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Gemini bio */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">Gemini says:</p>
            <p className="text-lg font-medium text-foreground">
              Fiddle Leaf Fig hates drafts and loves consistency.
            </p>
          </div>
          
          {/* Care schedule */}
          <div className="mb-6">
            <p className="text-sm font-medium text-muted-foreground mb-2">Care Schedule</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="flex h-6 w-6 items-center justify-center bg-green-100 rounded-full">
                  💧
                </div>
                <div>
                  <p className="font-medium">Water:</p>
                  <p className="text-sm text-muted-foreground">Every 7 days</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex h-6 w-6 items-center justify-center bg-yellow-100 rounded-full">
                  🌱
                </div>
                <div>
                  <p className="font-medium">Fertilize:</p>
                  <p className="text-sm text-muted-foreground">Monthly</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex h-6 w-6 items-center justify-center bg-blue-100 rounded-full">
                  🔄
                </div>
                <div>
                  <p className="font-medium">Rotate:</p>
                  <p className="text-sm text-muted-foreground">Weekly</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Health sparkline (simplified) */}
          <div className="mb-6">
            <p className="text-sm font-medium text-muted-foreground mb-2">Health Trend (30 days)</p>
            <div className="h-12 w-full bg-muted/50 rounded overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-green-600" style={{ width: '80%' }}></div>
            </div>
          </div>
          
          {/* AI Chat placeholder */}
          <div className="mb-6">
            <p className="text-sm font-medium text-muted-foreground mb-2">Ask Gemini about this plant</p>
            <div className="flex space-x-2">
              <input 
                type="text" 
                placeholder="What's wrong with my plant's leaves?" 
                className="flex-1 px-4 py-2 bg-muted/50 border border-muted/20 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
                Send
              </button>
            </div>
          </div>
          
          {/* Inline nickname editor */}
          <div className="mb-6 flex items-center space-x-3">
            {isNicknameEditing ? (
              <>
                <input 
                  value={editedNickname}
                  onChange={(e) => setEditedNickname(e.target.value)}
                  onBlur={handleSaveNickname}
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveNickname()}
                  className="flex-1 px-3 py-1 border border-muted/20 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button 
                  onClick={handleSaveNickname}
                  className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                >
                  Save
                </button>
                <button 
                  onClick={() => setIsNicknameEditing(false)}
                  className="px-3 py-1 text-muted-foreground text-sm hover:text-foreground hover:underline"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="font-medium flex-1">{plant.nickname}</span>
                <button 
                  onClick={() => setIsNicknameEditing(true)}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  ✏️ Edit
                </button>
              </>
            )}
          </div>
          
          {/* Archive button */}
          <button 
            className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Archive Plant
          </button>
        </div>
      </div>
    </div>
  );
};