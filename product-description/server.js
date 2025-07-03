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

// AU tone training examples
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

// Prompt builder with image fallback
function buildPrompt(title, imageUrl) {
  // Pick 3 random AU examples each time
  const examples = AU_EXAMPLES
    .sort(() => 0.5 - Math.random())     // shuffle
    .slice(0, 3)                         // take first 3
    .map(x => `"${x}"`)
    .join("\n");

  if (!imageUrl) {
    return {
      role: 'user',
      content: `You are a product copywriter for a premium UK fashion brand.

Your job is to rewrite the product title into a polished, professional, SEO-friendly retail title and write a short (max 30 words) product description matching the tone of these rotating Australian examples:

${examples}

Use the following input:
Original Title: "${title}"`
    };
  }

  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: `You are a product copywriter for a premium UK fashion brand.

Your job is to:
1. Rewrite the product title into a polished, professional, SEO-friendly retail title that’s clear and properly capitalised.
2. Write a short, stylish product description (max 30 words), matching the tone of these rotating Australian examples:

${examples}

Use the following input:
Original Title: "${title}"
Image:`
      },
      { type: 'image_url', image_url: { url: imageUrl } }
    ]
  };
}


  // Vision-enabled prompt
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: `You are a product copywriter for a premium UK fashion brand.

Your job is to:
1. Rewrite the product title into a polished, professional, SEO-friendly retail title that’s clear and properly capitalised.
2. Write a short, stylish product description (max 30 words), matching the tone of these Australian examples:

${examplesText}

Use the following input:
Original Title: "${title}"
Image:`
      },
      {
        type: 'image_url',
        image_url: { url: imageUrl }
      }
    ]
  };
}

app.post('/generate-description', async (req, res) => {
  const { title, imageUrl } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Missing title' });
  }

  try {
    let response;
    // Try vision; fallback to text-only if it fails
    try {
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [buildPrompt(title, imageUrl)],
        max_tokens: 150,
        temperature: 0.7,    // ← add this line
        top_p: 0.9,          // ← optional, ensures diversity but keeps quality
      });
      
    } catch (_) {
      console.warn(`[!] Vision failed for "${title}", retrying text-only`);
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [buildPrompt(title, null)],
        max_tokens: 150,
      });
    }

    const raw = response.choices[0].message.content.trim();
    console.log(`\n[✓] GPT Output for "${title}":\n${raw}\n`);

    // Strip smart quotes
    const safeOutput = raw.replace(/[“”]/g, '"');

    // Regex for title/description
    const titleMatch = safeOutput.match(/(?:title|rewritten product title|retail title)\s*[:\-]\s*["']?(.+?)["']?\s*(?:\n|$)/i);
    const descMatch  = safeOutput.match(/(?:description|product description)\s*[:\-]\s*["']?(.+?)["']?\s*(?:\n|$)/i);

    let formattedTitle = titleMatch ? titleMatch[1].trim() : '';
    let description   = descMatch  ? descMatch[1].trim() : '';

    // Remove markdown bold
    formattedTitle = formattedTitle.replace(/^\*\*|\*\*$/g, '').trim();
    description   = description.replace(/^\*\*|\*\*$/g, '').trim();

    // Fallback blank
    if (!formattedTitle && !description) {
      console.warn('[!] Blank parse, returning empty');
      return res.json({ formattedTitle: '', description: '' });
    }

    console.log('[→] Sending back to Sheets:', { formattedTitle, description });
    return res.json({ formattedTitle, description });

  } catch (error) {
    console.error(`[✗] Overall failure:`, error);
    return res.status(500).json({ error: 'Failed to generate output', detail: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
