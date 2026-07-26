import { useState } from 'react';
import { identifyPlant, PlantCare } from '../services/geminiService';

export const useGeminiAnalysis = () => {
  const [analysis, setAnalysis] = useState<PlantCare | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzePlant = async (base64Image: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await identifyPlant(base64Image);
      setAnalysis(result);
      return result;
    } catch (err: any) {
      const msg = err?.message || 'Failed to analyze plant';
      setError(msg);
      console.error('useGeminiAnalysis error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { analysis, loading, error, analyzePlant };
};