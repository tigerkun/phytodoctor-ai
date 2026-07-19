export interface Message {
  role: 'user' | 'model';
  content: string;
}

export async function chatWithGardener(messages: Message[]): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get bot response");
  }

  const result = await response.json();
  return result.content;
}
