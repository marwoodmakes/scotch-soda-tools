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
  "Make a statement in this satin wrap dress—draped waist and asymmetrical hem exude elegance from desk to dinner."
];

// Improved helpers: extract key product attributes instead of just truncating
function extractProductType(title) {
  const productTypes = ['jeans', 'shirt', 'jacket', 'tee', 'dress', 'blazer', 'cardigan', 'trousers', 'sneakers', 'coat', 'hoodie', 'polo', 'vest', 'poncho', 'joggers', 'skirt', 'blouse', 'pants', 'cap', 'hat'];
  const words = title.toLowerCase().split(/\s+/);
  return productTypes.find(type => words.includes(type)) || 'piece';
}

function extractSEOKeywords(title) {
  // Extract quantity, color, and product type for SEO
  const colors = ['black', 'white', 'navy', 'green', 'grey', 'beige', 'red', 'blue', 'charcoal', 'khaki', 'burgundy'];
  const quantities = ['pack', '3-pack', '2-pack', 'trio', 'set', 'pair'];
  const productTypes = ['jeans', 'shirt', 'jacket', 'tee', 'dress', 'blazer', 'cardigan', 'trousers', 'sneakers', 'coat', 'hoodie', 'polo', 'vest', 'poncho', 'joggers', 'skirt', 'blouse', 'pants', 'cap', 'hat', 'boxers', 'underwear', 'socks', 'briefs'];
  
  const titleWords = title.toLowerCase().split(/\s+/);
  const seoKeywords = [];
  
  // Find color
  const foundColor = colors.find(color => titleWords.includes(color));
  if (foundColor) seoKeywords.push(foundColor);
  
  // Find quantity
  const foundQuantity = quantities.find(qty => titleWords.includes(qty));
  if (foundQuantity) seoKeywords.push(foundQuantity);
  
  // Find product type
  const foundProduct = productTypes.find(product => titleWords.includes(product));
  if (foundProduct) seoKeywords.push(foundProduct);
  
  return seoKeywords;
}

function createBannedPhrases() {
  // Ban overused phrases instead of individual words
  return [
    'ultimate comfort', 'unparalleled comfort', 'all-day ease', 'all-day comfort',
    'step into', 'meet ultimate', 'get ready for', 'crafted for', 'designed for',
    'perfect blend', 'seamless fit', 'modern fit', 'stylish design', 'premium quality'
  ];
}

function truncateTitle(text) {
  const stopWords = ['black', 'white', 'navy', 'green', 'grey', 'beige', 'red', 'blue', 'pack', '3-pack', '2-pack', 'mens', 'kids', 'women', "women's"];
  return text
    .split(/\s+/)
    .filter(w => !stopWords.includes(w.toLowerCase()))
    .slice(0, 4)
    .join(' ');
}

function truncateDescription(text) {
  return text
    .split(/\s+/)
    .slice(0, 15)
    .join(' ');
}

// Improved prompt with clearer instructions and better structure
function buildPrompt(title, imageUrl) {
  const examples = AU_EXAMPLES
    .sort(() => 0.5 - Math.random())
    .slice(0, 3)
    .map(x => `"${x}"`)
    .join("\n");
  
  const seoKeywords = extractSEOKeywords(title);
  const bannedPhrases = createBannedPhrases();
  
  const instruction = `You are a product copywriter for a premium UK fashion brand.

CRITICAL RULES:
- Write ONLY a product description (no title, no prefixes)
- Include these SEO keywords naturally: ${seoKeywords.join(', ')}
- AVOID these overused phrases: ${bannedPhrases.join(', ')}
- Be specific and varied - no generic comfort language
- Keep it concise: ~12-15 words maximum
- Focus on unique benefits, materials, or styling details

VOICE OPTIONS (pick one randomly):
1. Conversational: "You'll love..."
2. Technical: "Engineered with..."
3. Story: "From desk to dinner..."
4. Minimalist: "Soft. Sleek. Ready."
5. Playful: "Turn heads with..."

STYLE EXAMPLES:
${examples}

TASK:
Write a fresh, specific description that includes the SEO keywords but avoids clichés.
Focus on what makes this product unique or special.

Original Title: "${title}"`;

  if (!imageUrl) {
    return { role: 'user', content: instruction };
  }
  return {
    role: 'user',
    content: [
      { type: 'text', text: instruction + '\n\nImage:' },
      { type: 'image_url', image_url: { url: imageUrl } }
    ]
  };
}

// Improved response parsing to fix "Title:" bleeding issue
function parseResponse(rawResponse, originalTitle) {
  let description = rawResponse
    .replace(/\*\*/g, '')
    .replace(/[""]/g, '"')
    .trim();

  // Remove any prefixes more aggressively
  description = description.replace(/^(?:Title|Description|Product)[:\-]\s*/gi, '');
  
  // Remove any numbering or bullet points
  description = description.replace(/^\d+\.\s*/, '');
  description = description.replace(/^[\-\*]\s*/, '');
  
  // If it starts with "Title:" anywhere in the text, extract only the part after it
  if (description.includes('Title:')) {
    const titleMatch = description.match(/Title:\s*(.+?)(?:\n|$)/i);
    if (titleMatch) {
      description = titleMatch[1].trim();
    }
  }
  
  // Take first sentence/line if multiple lines
  const firstLine = description.split('\n')[0];
  description = firstLine || description;
  
  // Remove any remaining "Title:" at the start
  description = description.replace(/^Title:\s*/i, '');
  
  // Final cleanup and truncation
  description = truncateDescription(description);
  
  return description;
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
        max_tokens: 100, // Reduced to force conciseness
        temperature: 0.8, // Slightly higher for more creativity
        top_p: 0.9
      });
    } catch (_) {
      console.warn(`Vision failed for "${title}", retrying without image`);
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [buildPrompt(title, null)],
        max_tokens: 100,
        temperature: 0.8,
        top_p: 0.9
      });
    }

    const rawContent = response.choices[0].message.content;
    const description = parseResponse(rawContent, title);
    const formattedTitle = truncateTitle(title);
    const seoKeywords = extractSEOKeywords(title);

    console.log('[→] Original:', title);
    console.log('[→] SEO Keywords:', seoKeywords.join(', '));
    console.log('[→] Raw AI Response:', rawContent);
    console.log('[→] Formatted Title:', formattedTitle);
    console.log('[→] Final Description:', description);
    console.log('---');

    res.json({ formattedTitle, description });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate output', detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});