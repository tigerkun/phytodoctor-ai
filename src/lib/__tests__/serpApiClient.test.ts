import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  serpApiEnabled,
  serpApiStatus,
  extractRelatedQuestions,
  extractEnvironmentalNews,
  serpApiSearch,
  _resetSerpApiStateForTests,
} from '../serpApiClient';

describe('serpApiClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    _resetSerpApiStateForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetSerpApiStateForTests();
    vi.restoreAllMocks();
  });

  describe('serpApiEnabled and credentials', () => {
    it('returns false when SERPAPI_API_KEY is missing or empty', () => {
      delete process.env.SERPAPI_API_KEY;
      expect(serpApiEnabled()).toBe(false);

      process.env.SERPAPI_API_KEY = '   ';
      expect(serpApiEnabled()).toBe(false);
    });

    it('returns true when valid key is provided', () => {
      process.env.SERPAPI_API_KEY = 'test_serp_key';
      expect(serpApiEnabled()).toBe(true);
      const status = serpApiStatus();
      expect(status.enabled).toBe(true);
      expect(status.searchesUsed).toBe(0);
      expect(status.monthlyLimit).toBe(250);
      expect(status.disabledReason).toBeNull();
    });
  });

  describe('extractRelatedQuestions', () => {
    it('extracts valid related questions with snippets', () => {
      const payload = {
        related_questions: [
          {
            question: 'Why do monstera leaves turn yellow?',
            snippet: 'Overwatering is the most common reason for yellow monstera leaves.',
            link: 'https://example.com/monstera',
          },
          {
            question: 'Incomplete question without snippet',
          },
          {
            question: 'How often should you water orchids?',
            snippet: 'Water orchids about once a week when the bark media dries out.',
          },
        ],
      };

      const extracted = extractRelatedQuestions(payload, 3);
      expect(extracted).toHaveLength(2);
      expect(extracted[0].question).toBe('Why do monstera leaves turn yellow?');
      expect(extracted[0].snippet).toContain('Overwatering');
      expect(extracted[1].question).toBe('How often should you water orchids?');
    });

    it('returns empty array when no related questions are present', () => {
      expect(extractRelatedQuestions({})).toEqual([]);
      expect(extractRelatedQuestions(null)).toEqual([]);
    });
  });

  describe('extractEnvironmentalNews', () => {
    it('extracts and normalizes news articles', () => {
      const payload = {
        news_results: [
          {
            title: 'Amazon rainforest biodiversity milestone achieved',
            link: 'https://news.example.com/amazon',
            source: { name: 'Botanical Science Daily' },
            date: '2 hours ago',
            snippet: 'Researchers discover resilient plant community in the western basin.',
            thumbnail: 'https://news.example.com/thumb.jpg',
          },
          {
            title: 'Rare orchid rediscovered in cloud forest',
            link: 'https://news.example.com/orchid',
            date: 'Yesterday',
          },
          {
            // Missing title or link
            source: { name: 'Incomplete News' },
          },
        ],
      };

      const news = extractEnvironmentalNews(payload, 10);
      expect(news).toHaveLength(2);
      expect(news[0].title).toBe('Amazon rainforest biodiversity milestone achieved');
      expect(news[0].source).toBe('Botanical Science Daily');
      expect(news[0].snippet).toContain('resilient plant community');
      expect(news[1].source).toBe('News'); // fallback
    });

    it('returns empty array on empty payload', () => {
      expect(extractEnvironmentalNews({})).toEqual([]);
    });
  });

  describe('serpApiSearch circuit breaker and quota', () => {
    it('returns null and does not throw when disabled', async () => {
      delete process.env.SERPAPI_API_KEY;
      const res = await serpApiSearch('google', { q: 'test' });
      expect(res).toBeNull();
    });

    it('trips circuit breaker on quota rejection (429)', async () => {
      process.env.SERPAPI_API_KEY = 'test_key';
      global.fetch = vi.fn().mockResolvedValue({
        status: 429,
        ok: false,
      } as any);

      const res = await serpApiSearch('google', { q: 'test' });
      expect(res).toBeNull();
      expect(serpApiEnabled()).toBe(false);
      expect(serpApiStatus().disabledReason).toContain('quota exhausted');
    });
  });
});
