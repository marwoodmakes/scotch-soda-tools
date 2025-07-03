const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const AU_EXAMPLES = [
  "Experience casual comfort and style with our Pitch Loose Fit Jeans – the perfect addition to your everyday wardrobe.",
  "This button-up shirt features a subtle dobby stripe for a touch of texture and a modern silhouette.",
  "Step out in style with this classic quilted jacket – warm, versatile, and effortlessly cool.",
  "Embrace effortless style with this raw edge relaxed fit tee – a wardrobe staple for everyday wear.",
  "Adjustable cap for a customizable fit with logo detail – everyday comfort meets low-key statement."
];

function buildPrompt(title, imageUrl) {
  const examplesText = AU_EXAMPLES.map(x => `"${x}"`).join("\n");

  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text:
`You are a product copywriter for a premium UK fashion brand.

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

  if (!title || !imageUrl) {
    return res.status(400).json({ error: 'Missing title or imageUrl' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [buildPrompt(title, imageUrl)],
      max_tokens: 150,
    });
  
    const raw = response.choices[0].message.content.trim();
    console.log(`\n[✓] GPT Output for: "${title}"\n${raw}\n`);
  
    const titleMatch = raw.match(/(?:title|refined title)\W*\n*["“”]*(.+?)["“”]*\n/i);
    const descMatch = raw.match(/description\W*\n*["“”]*(.+?)["“”]*\n?/i);
  
    const formattedTitle = titleMatch ? titleMatch[1].trim() : '';
    const description = descMatch ? descMatch[1].trim() : '';
  
    console.log('[→] Sending back to Sheets:', { formattedTitle, description });
  
    // Send clean output regardless
    res.json({
      formattedTitle: formattedTitle || 'Unparsed Output',
      description: description || raw
    });
  
  } catch (error) {
    console.error(`[✗] Failed to generate output:`, error);
    res.status(500).json({ error: 'Failed to generate output', detail: error.message });
  }
  
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
