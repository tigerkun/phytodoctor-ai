import assert from 'node:assert';
import { chatWithBotanist, chatWithGardener, type Message } from './chatService.js';

// Format message logic mirroring Assistant.tsx
function formatMessage(text: string | null | undefined) {
  if (!text || typeof text !== 'string') return { __html: '' };
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const escaped = cleanText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-moss-dark dark:text-[#a8d5a8]">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em class="italic opacity-90">$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px]">$1</code>');
  
  const lines = html.split('\n');
  const formattedLines = lines.map(line => {
    const trimmed = line.trim();
    // Numbered care directives
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      return `<div class="flex items-start gap-2 my-1.5 pl-1"><span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-moss/20 text-moss text-[10px] font-mono font-bold shrink-0 mt-0.5 border border-moss/30">${numMatch[1]}</span><span class="flex-1">${numMatch[2]}</span></div>`;
    }
    // Bullet lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return `<li class="ml-5 list-disc mb-1 leading-snug">${trimmed.substring(2)}</li>`;
    }
    return line;
  });

  const joined = formattedLines.join('<br />').replace(/(<\/div>|<\/li>)<br \/>/g, '$1');
  return { __html: joined };
}

// Safe URL decoding logic mirroring Assistant.tsx
function safeDecode(val: string | null | undefined): string {
  if (!val) return '';
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

// Format Dexie note payload
function prepareNotePayload(plantName: string | null, content: string, index: number) {
  const decodedPlant = safeDecode(plantName);
  const plantSlug = decodedPlant
    ? decodedPlant.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    : 'botanical-consultation';

  return {
    id: `dispatch-${Date.now()}-${index}`,
    plantId: plantSlug || 'botanical-consultation',
    userId: 'local-gardener',
    content: content.replace(/<[^>]*>?/gm, ''),
    category: 'observation' as const,
    tags: ['botanist-dispatch', 'kew-consultation', decodedPlant || 'botanical-advice'],
    createdAt: new Date()
  };
}

// Sanitize chat contents logic mirroring server.ts
function sanitizeChatContents(messages: Message[]) {
  let formattedContents = messages
    .filter(m => m && typeof m.content === 'string' && m.content.trim().length > 0)
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

  while (formattedContents.length > 0 && formattedContents[0].role === 'model') {
    formattedContents.shift();
  }

  return formattedContents;
}

async function runCheck() {
  console.log('Running Assistant Chief Botanist correspondence desk assert checks...');

  // 1. Verify chat service exports
  assert.strictEqual(typeof chatWithBotanist, 'function', 'chatWithBotanist must be exported as a function');
  assert.strictEqual(chatWithBotanist, chatWithGardener, 'chatWithBotanist must be identical to chatWithGardener');

  // 2. HTML escaping against script injection
  const dangerousInput = '<script>alert("xss")</script> & <b>test</b>';
  const escapedResult = formatMessage(dangerousInput);
  assert(!escapedResult.__html.includes('<script>'), 'Dangerous tags must be escaped');
  assert(escapedResult.__html.includes('&lt;script&gt;'), 'Angle brackets must be converted to HTML entities');
  assert(escapedResult.__html.includes('&amp;'), 'Ampersands must be escaped');

  // 3. Bold, Italic & Inline Code markdown parsing
  const markdownText = 'This is **essential care** with *moderate watering* and `pH 6.5`.';
  const parsedMd = formatMessage(markdownText);
  assert(parsedMd.__html.includes('<strong class="font-bold text-moss-dark dark:text-[#a8d5a8]">essential care</strong>'), 'Bold syntax must be converted to strong tags');
  assert(parsedMd.__html.includes('<em class="italic opacity-90">moderate watering</em>'), 'Italic syntax must be converted to em tags');
  assert(parsedMd.__html.includes('<code class="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px]">pH 6.5</code>'), 'Inline code must be converted to code tag');

  // 4. Numbered care directives parsing & no duplicate br
  const directives = "1. Flush the soil with distilled water\n2. Calibrate indirect light exposure\n3. Apply neem oil emulsion";
  const parsedDirectives = formatMessage(directives);
  assert(parsedDirectives.__html.includes('>1</span>'), 'Directive 1 must have badge numeral');
  assert(parsedDirectives.__html.includes('>2</span>'), 'Directive 2 must have badge numeral');
  assert(parsedDirectives.__html.includes('>3</span>'), 'Directive 3 must have badge numeral');
  assert(parsedDirectives.__html.includes('Flush the soil with distilled water'), 'Directive content must be preserved');
  assert(!parsedDirectives.__html.includes('</div><br />'), 'Should not have trailing br after div element');

  // 5. Bullet list parsing
  const bulletList = "- Maintain 60% ambient humidity\r\n* Check root ball weekly";
  const parsedBullets = formatMessage(bulletList);
  assert(parsedBullets.__html.includes('<li class="ml-5 list-disc mb-1 leading-snug">Maintain 60% ambient humidity</li>'), 'Hyphen bullet must become li');
  assert(parsedBullets.__html.includes('<li class="ml-5 list-disc mb-1 leading-snug">Check root ball weekly</li>'), 'Star bullet must become li');
  assert(!parsedBullets.__html.includes('</li><br />'), 'Should not have trailing br after li element');

  // 6. Safe URL decoding
  assert.strictEqual(safeDecode('50%20shade'), '50 shade', 'Standard URL percent encoding should decode');
  assert.strictEqual(safeDecode('50% shade'), '50% shade', 'Malformed percent strings must not throw URIError');
  assert.strictEqual(safeDecode(''), '', 'Empty string returns empty');
  assert.strictEqual(safeDecode(null), '', 'Null returns empty');
  assert.strictEqual(safeDecode(undefined), '', 'Undefined returns empty');

  // 7. Persistence payload validation
  const sampleContent = 'Apply **copper fungicide** twice weekly.';
  const notePayload = prepareNotePayload("Ficus elastica 'Burgundy'", sampleContent, 1);
  assert.strictEqual(notePayload.plantId, 'ficus-elastica-burgundy', 'Plant ID must be safely slugified');
  assert.strictEqual(notePayload.userId, 'local-gardener', 'User ID must be local-gardener');
  assert.strictEqual(notePayload.category, 'observation', 'Category must be observation');
  assert(notePayload.tags.includes('botanist-dispatch'), 'Must include botanist-dispatch tag');
  assert(notePayload.tags.includes('kew-consultation'), 'Must include kew-consultation tag');
  assert(notePayload.tags.includes("Ficus elastica 'Burgundy'"), 'Must include plant name tag');

  // Fallback plantId when null or malformed percent
  const defaultNote = prepareNotePayload(null, sampleContent, 2);
  assert.strictEqual(defaultNote.plantId, 'botanical-consultation', 'Should use fallback plant ID');
  assert(defaultNote.tags.includes('botanical-advice'), 'Should include fallback advice tag');

  const percentNote = prepareNotePayload('50% shade pothos', sampleContent, 3);
  assert.strictEqual(percentNote.plantId, '50-shade-pothos', 'Should slugify percent string without throw');

  // 8. Multi-turn sanitization for Gemini API (strip initial model message)
  const conversation: Message[] = [
    { role: 'model', content: 'Greetings! I am the Chief Botanist.' },
    { role: 'user', content: 'How do I treat root rot?' }
  ];
  const sanitized = sanitizeChatContents(conversation);
  assert.strictEqual(sanitized.length, 1, 'Initial synthetic model message must be stripped for Gemini multi-turn');
  assert.strictEqual(sanitized[0].role, 'user', 'First turn must be user');
  assert.strictEqual(sanitized[0].parts[0].text, 'How do I treat root rot?');

  // 9. Message serialization check
  const testMessages: Message[] = [
    { role: 'model', content: 'Welcome to Kew Station.' },
    { role: 'user', content: 'What is wrong with my pothos?' }
  ];
  const serialized = JSON.stringify(testMessages);
  const deserialized = JSON.parse(serialized);
  assert.strictEqual(deserialized.length, 2);
  assert.strictEqual(deserialized[0].role, 'model');
  assert.strictEqual(deserialized[1].role, 'user');

  // 10. Null and empty text tolerance in formatMessage
  assert.strictEqual(formatMessage(null).__html, '', 'Null input returns empty html');
  assert.strictEqual(formatMessage(undefined).__html, '', 'Undefined input returns empty html');
  assert.strictEqual(formatMessage('').__html, '', 'Empty string returns empty html');

  console.log('✓ All Assistant Chief Botanist checks passed successfully.');
}

runCheck().catch((err) => {
  console.error('✗ Assistant check failed:', err);
  process.exit(1);
});
