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
  "Experience casual comfort and style with our Pitch Loose Fit Jeans – the perfect addition to your everyday wardrobe.",
  "This button-up shirt features a subtle dobby stripe for a touch of texture and a modern silhouette.",
  "Step out in style with this classic quilted jacket – warm, versatile, and effortlessly cool.",
  "Embrace effortless style with this raw edge relaxed fit tee – a wardrobe staple for everyday wear.",
  "Adjustable cap for a customizable fit with logo detail – everyday comfort meets low-key statement.",
  "Embrace laid-back luxury with these mid-rise straight-leg trousers—crafted from breathable linen for effortless style and all-day ease.",
  "Elevate your look with this double-breasted wool blazer—tailored fit meets timeless sophistication in a versatile charcoal hue.",
  "Slip into comfort with our ultra-soft modal lounge tee—relaxed silhouette and scoop neckline make it a go-to for casual weekends.",
  "Layer up in style with this chunky cable-knit cardigan—cozy collar detail and patch pockets combine warmth with modern flair.",
  "Make a statement in this satin wrap dress—draped waist and asymmetrical hem exude elegance from desk to dinner.",
  "Step into season-ready style with these leather-trimmed suede sneakers—contrast piping and cushioned sole for on-trend comfort.",
  "Add edge to any outfit with this distressed denim jacket—oversized fit and raw-edge cuffs deliver cool, carefree vibes.",
  "Stay sleek and dry with this water-resistant trench coat—structured shoulders and belted waist define a polished, purposeful look.",
  "Compliment your wardrobe with our silk-blend button-down—subtle sheen and relaxed drape make it perfect for smart-casual days.",
  "Keep it minimal in these tailored drawstring joggers—stretch cotton fabric and ankle-gathered cuffs strike the perfect balance of comfort and refinement.",
  "Channel retro vibes in this high-waisted corduroy skirt—rich texture and button-front design for vintage-inspired charm.",
  "Go sporty-chic with these water-repellent track pants—side stripe detailing and elasticated waist for active versatility.",
  "Opt for bohemian flair in this embroidered peasant blouse—delicate lace trim and flowing silhouette for free-spirited style.",
  "Commit to clean lines in this minimalist shift dress—sleek cut and neutral tone for effortless, modern elegance.",
  "Discover eco-friendly style with this recycled denim jacket—raw hem and organic cotton lining for sustainable fashion.",
  "Stand out in this bold geometric-print bomber jacket—vibrant colors and fitted cuffs for a statement-making look.",
  "Achieve timeless sophistication with this tailored houndstooth blazer—structured shoulders and classic pattern for refined appeal.",
  "Embrace playful charm in these polka-dot culottes—wide leg design and high waist for fun, flattering movement.",
  "Convey urban edge in this faux-leather moto vest—asymmetric zipper and snap collar for downtown cool.",
  "Enjoy coastal ease in this lightweight linen button-up—breathable fabric and relaxed fit for sunny days by the sea.",
  "Invoke artisanal craftsmanship in this hand-knit wool poncho—intricate stitch patterns and fringed hem for unique texture.",
  "Add a futuristic twist with these reflective joggers—tech-infused fabric and zip pockets for modern utility.",
  "Showcase classic preppy style in this striped pique polo—contrast tipping and three-button placket for refined casualwear.",
  "Capture city sophistication in this tailored velvet tuxedo jacket—sleek satin lapels and single-button closure for evening elegance.",
  "Embody laid-back athleisure in this performance hoodie—moisture-wicking blend and ergonomic seams for everyday comfort.",
  "Step up in statement sneakers—chunky sole and mixed-material upper for head-turning street style.",
  "Slip into avant-garde minimalism with this asymmetrical tunic—sculptural draping and monochrome palette for fashion-forward flair."
];


// Helpers: minimal change title, truncate description
function cleanTitle(text) {
  return text.trim();
}

function truncateDescription(text) {
  // Strip any "Description:" prefix
  const desc = text.replace(/^(?:Description[:\-]\s*)/i, '');
  return desc.split(/\s+/).slice(0, 15).join(' ');
}

// Build prompt with rotating voices and dynamic bans
function buildPrompt(title, imageUrl) {
  const examples = AU_EXAMPLES
    .sort(() => 0.5 - Math.random())
    .slice(0, 3)
    .map(x => `"${x}"`)
    .join("\n");
  const banned = title
    .split(/\s+/)
    .map(w => w.toLowerCase())
    .join(', ');

  const instruction = `
You are a product copywriter for a premium UK fashion brand.

Pick one voice at random:
1. Conversational (“You’ll love…”)`
  + `
2. Technical (“Engineered for…”)` + `
3. Story (“From dawn to dusk…”)` + `
4. Minimalist (“Soft. Sleek. Ready.”)` + `
5. Playful (“Get ready…!”)

Rules:
– Title: minimal change from input.
– Description: ~15 words, avoid these: ${banned}
– Start with You’ll, Get, Meet, Step, or Try.

Examples (pick any 3):
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
    let response;
    try {
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [buildPrompt(title, imageUrl)],
        max_tokens: 200,
        temperature: 0.7,
        top_p: 0.9
      });
    } catch (_) {
      console.warn(`Vision failed for "${title}", retrying without image`);
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [buildPrompt(title, null)],
        max_tokens: 200,
        temperature: 0.7,
        top_p: 0.9
      });
    }

    const raw = response.choices[0].message.content.replace(/\*\*/g, '').trim();
    const safe = raw.replace(/[“”]/g, '"');

    // Only extract description
    const descMatch = safe.match(/(?:Description[:\-]\s*)(.+?)(?:\n|$)/i);
    let description = descMatch ? descMatch[1].trim() : safe;
    description = truncateDescription(description);

    // Keep title as minimal input
    const formattedTitle = cleanTitle(title);

    console.log('[→] Sending back to Sheets:', { formattedTitle, description });
    res.json({ formattedTitle, description });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate output', detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});