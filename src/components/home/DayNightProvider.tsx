import React, { createContext, useEffect, useState } from 'react';

// 4 ambient scene modes as seen in the UI
export type Theme = 'day' | 'night';
export type AmbientScene = 'morning' | 'day' | 'city' | 'night';

export interface DayNightContextType {
  theme: Theme;
  ambientScene: AmbientScene;
  setAmbientScene: (scene: AmbientScene) => void;
  toggleTheme: () => void;
  isAutomatic: boolean;
}

export const DayNightContext = createContext<DayNightContextType | undefined>(undefined);

function getAutoTheme(): Theme {
  const hours = new Date().getHours();
  return hours >= 6 && hours < 18 ? 'day' : 'night';
}

function getAutoScene(): AmbientScene {
  const hours = new Date().getHours();
  if (hours >= 5 && hours < 11) return 'morning';
  if (hours >= 11 && hours < 19) return 'day';
  return 'night';
}

// Map scene to base theme for CSS variable switching
const SCENE_THEME: Record<AmbientScene, Theme> = {
  morning: 'day',
  day: 'day',
  city: 'night',
  night: 'night',
};

export function DayNightProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('day');
  const [ambientScene, setAmbientSceneState] = useState<AmbientScene>('day');
  const [isAutomatic, setIsAutomatic] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const storedScene = localStorage.getItem('ambient-scene') as AmbientScene | null;
    if (storedScene && ['morning', 'day', 'city', 'night'].includes(storedScene)) {
      setAmbientSceneState(storedScene);
      setTheme(SCENE_THEME[storedScene]);
      setIsAutomatic(false);
    } else {
      setAmbientSceneState(getAutoScene());
      setTheme(getAutoTheme());
      setIsAutomatic(true);
    }
    setMounted(true);
  }, []);

  // Apply theme to DOM
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.transition = 'background 1.2s ease-in-out, color 1.2s ease-in-out';
  }, [theme, mounted]);

  const setAmbientScene = (scene: AmbientScene) => {
    setAmbientSceneState(scene);
    setTheme(SCENE_THEME[scene]);
    setIsAutomatic(false);
    localStorage.setItem('ambient-scene', scene);
  };

  const toggleTheme = () => {
    if (!isAutomatic) {
      // Reset to auto
      setAmbientSceneState(getAutoScene());
      setTheme(getAutoTheme());
      setIsAutomatic(true);
      localStorage.removeItem('ambient-scene');
    } else {
      const newScene: AmbientScene = theme === 'day' ? 'night' : 'day';
      setAmbientScene(newScene);
    }
  };

  return (
    <DayNightContext.Provider value={{ theme, ambientScene, setAmbientScene, toggleTheme, isAutomatic }}>
      {children}
    </DayNightContext.Provider>
  );
}
