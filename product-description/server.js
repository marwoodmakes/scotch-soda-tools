const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AU tone training examples (30 diverse lines)
const AU_EXAMPLES = [
  /* …your 30 examples… */
];

// Helpers
function truncateTitle(text) {
  const stopWords = ['black','white','navy','green','grey','beige','red','blue',
                     'pack','3-pack','2-pack','mens','kids','women',"women's"];
  return text
    .split(/\s+/)
    .filter(w => !stopWords.includes(w.toLowerCase()))
    .slice(0, 4)
    .join(' ');
}
function truncateDescription(text) {
  return text
    .replace(/title[:\-]\s*.+$/i, '')     // drop any trailing “Title:” bits
    .replace(/\.{2,}$/,'')                // drop ellipsis at end
    .split(/[.!?]+/)[0]                   // keep only first sentence
    .trim();
}

// Build prompt
function buildPrompt(title, imageUrl) {
  const examples = AU_EXAMPLES
    .sort(() => 0.5 - Math.random())
    .slice(0, 3)
    .map(x => `"${x}"`)
    .join("\n");
  const banned = title.split(/\s+/).map(w => w.toLowerCase()).join(', ');

  const instruction = `
You are a product copywriter for a premium UK fashion brand.

Pick one voice style at random:
1. Conversational (“You’ll love…”)
2. Technical (“Engineered for…”)
3. Story (“From dawn to dusk…”)
4. Minimalist (“Soft. Sleek. Ready.”)
5. Playful (“Get ready…!”)

Rules:
– Title: create a fresh variation of the original (≤4 key words).
– Description: ~15 words, complete sentence. Don’t reuse any words from the title or these banned terms: ${banned}
– Do not include the word “title” anywhere in the description.
– Begin your description with one of: You’ll, Get, Meet, Step, Try.

Illustrative examples (pick any 3):
${examples}

Original Title: "${title}"`;

  if (!imageUrl) {
    return { role: 'user', content: instruction };
  }
  return {
    role: 'user',
    content: [
      { type: 'text', text: instruction + '\nImage:' },
      { type: 'image_url', image_url: { url: imageUrl } }
    ]
  };
}

app.post('/generate-description', async (req, res) => {
  const { title, imageUrl } = req.body;
  if (!title) return res.status(400).json({ error: 'Missing title' });

  try {
    let resp;
    try {
      resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [buildPrompt(title, imageUrl)],
        max_tokens: 200,
        temperature: 0.7,
        top_p: 0.9
      });
    } catch {
      resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [buildPrompt(title, null)],
        max_tokens: 200,
        temperature: 0.7,
        top_p: 0.9
      });
    }

    const raw = resp.choices[0].message.content.replace(/\*\*/g, '').trim();
    const safe = raw.replace(/[“”]/g, '"');

    // Extract fresh title vs description
    const tMatch = safe.match(/^(?:\d+\.\s*)?(?:Title[:\-]\s*)?(.+?)(?:\n|$)/im);
    const dMatch = safe.match(/(?:Description[:\-]\s*)([^\n]+)/i);

    let newTitle    = tMatch ? tMatch[1].trim() : title;
    let newDesc     = dMatch ? dMatch[1].trim() : safe;
    newTitle        = truncateTitle(newTitle);
    newDesc         = truncateDescription(newDesc);

    console.log('[→] Sending back to Sheets:', { formattedTitle: newTitle, description: newDesc });
    res.json({ formattedTitle: newTitle, description: newDesc });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Generation failed', detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
