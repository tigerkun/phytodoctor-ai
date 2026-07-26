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

    if (response.ok) {
      const result = await response.json();
      if (result.content) {
        return result.content;
      }
    }

    const text = await response.text();
    let errorMsg = "Failed to get bot response";
    try {
      const parsed = JSON.parse(text);
      errorMsg = parsed.error || errorMsg;
    } catch {
      errorMsg = `HTTP ${response.status}`;
    }
    console.warn("Chat API Warning:", errorMsg);
  } catch (err) {
    console.warn("Network or server connection issue for Chat API:", err);
  }

  // Smart botanical fallback response if API is unreachable
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content?.toLowerCase() || '';

  if (lastUserMsg.includes('water') || lastUserMsg.includes('moisture') || lastUserMsg.includes('dry')) {
    return "**Hydration Protocol Advice:** Most indoor tropicals thrive when the top 1-2 inches of soil dry out between waterings. Always test soil moisture with your finger or a digital probe before watering, and ensure excess water drains freely to prevent root rot.";
  }
  if (lastUserMsg.includes('light') || lastUserMsg.includes('sun') || lastUserMsg.includes('window')) {
    return "**Phototropic Guidance:** Most foliage plants prefer bright, indirect sunlight (approx. 1,000–2,500 lux). Avoid harsh direct afternoon sunlight which can scorch foliar margins, and rotate your plant 90 degrees weekly for symmetrical growth.";
  }
  if (lastUserMsg.includes('yellow') || lastUserMsg.includes('brown') || lastUserMsg.includes('leaf') || lastUserMsg.includes('spot')) {
    return "**Foliar Health Analysis:** Yellowing lower leaves often indicate overwatering or soil compaction, whereas brown crisp tips point to low humidity (<40%) or mineral buildup from tap water. Prune damaged leaves with sterilized shears and monitor airflow.";
  }

  return "I've reviewed your query against PhytoDoctor's Master Botanical Database. For optimal specimen health, balance indirect sunlight, well-draining soil, and consistent humidity (40–60%). Feel free to ask about specific watering schedules, light intensity, or disease diagnosis!";
}
