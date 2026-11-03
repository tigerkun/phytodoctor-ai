import type { GardenContext } from '../lib/assistantContext';

export interface Message {
  role: 'user' | 'model';
  content: string;
}

export async function chatWithGardener(messages: Message[], garden?: GardenContext): Promise<string> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem('botanical_guardian_auth_token') || ''}`,
      },
      body: JSON.stringify(garden ? { messages, garden } : { messages }),
    });

    const result = await response.json();
    if (response.ok && result.content) return result.content;
    throw new Error(result.error || `HTTP ${response.status}`);
  } catch (err) {
    console.warn("Network or server connection issue for Chat API:", err);
    throw err;
  }
}

export const chatWithBotanist = chatWithGardener;
