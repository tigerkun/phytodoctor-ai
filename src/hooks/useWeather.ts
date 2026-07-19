import { useState, useEffect } from 'react';

export const useWeather = () => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWeather = async (city: string = 'Delhi') => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real implementation, this would call a weather API
      // For now, we'll simulate with mock data
      const mockWeather = {
        temp: Math.floor(Math.random() * 15) + 25, // 25-40°C
        humidity: Math.floor(Math.random() * 30) + 50, // 50-80%
        city: city,
        tip: Math.random() > 0.5 
          ? 'Tropical plants loving this. Succulents need less water.'
          : 'Great day for photosynthesis. Consider misting your ferns.',
        schedule: ['Morning', 'Evening', 'Night'] // Simplified
      };
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setWeather(mockWeather);
      return mockWeather;
    } catch (err) {
      setError('Failed to fetch weather data');
      console.error(err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Fetch weather on mount
  useEffect(() => {
    fetchWeather();
  }, []);

  return { weather, loading, error, fetchWeather };
};