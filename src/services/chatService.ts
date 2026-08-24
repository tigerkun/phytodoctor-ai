export interface Message {
  role: 'user' | 'model';
  content: string;
}

export async function chatWithGardener(messages: Message[]): Promise<string> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    const result = await response.json();
    if (response.ok && result.content) return result.content;
    throw new Error(result.error || `HTTP ${response.status}`);
  } catch (err) {
    console.warn("Network or server connection issue for Chat API:", err);
    throw err;
  }

}
