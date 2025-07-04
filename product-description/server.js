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

// AU tone training examples (expanded with natural variations)
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
  "This adjustable cap allows for a customizable fit ensuring maximum comfort and practicality. Its versatile design makes it the perfect accessory for any outdoor activity or casual outing.",
  "Embrace effortless style with this raw edge relaxed fit t-shirt. Its scoop neck and short sleeves make it a versatile classic fit piece perfect for everyday wear.",
  "Experience casual comfort and style with our Pitch loose fit jeans. Sitting low on the waist these jeans are designed for a relaxed and easy-going look.",
  "Step out in style with this classic quilted jacket. The collared button-up design is complemented by a unique geometric quilting and front pockets for utility.",
  "Flow through your day in this sheer v-neck maxi dress featuring dramatic sleeves and a captivating floral pattern. It's graceful and effortlessly stylish.",
  "This jewel neckline pullover combines texture with a stretchy fit for a look that's as comfortable as it is classic.",
  "Dive into Amsterdam's essence with this sleek bandana featuring a city-inspired minimal print. Ideal for an urban chic look.",
  "Channel retro vibes with a modern twist in the Charm flared jeans. The high-quality cotton blend ensures comfort and flexibility making them a perfect pick for weekend family road trips.",
  "Make a statement from day to night in our denim wide leg jumpsuit. Designed with a balance of cotton Lyocell for ultimate versatility.",
  "Twirl into elegance with this tulle layered skirt. Featuring layers of soft tulle this skirt adds a whimsical and dreamy touch to any outfit.",
  "Capture the laidback essence of Amsterdam with this oversized shirt. Featuring a minimalist city print it's effortlessly stylish and pairs well with anything.",
  "This jogger redefines relaxed luxury with a wide leg and easy drawstring waist promising ultimate comfort and ease.",
  "Embrace the essence of outdoor tranquility with this park print shirt. Its button-up design and short sleeves offer effortless style.",
  "Versatility is at the forefront with this classic vintage bomber jacket that's reversible offering two distinct looks in one piece.",
  "From morning meetings to evening outings these lightly stonewashed pieces transition seamlessly through your day.",
  "Refresh your wardrobe with our girlfriend poplin shirt. This piece features a relaxed girlfriend fit and is made from crisp poplin offering a polished look.",
  "This breathable ribbed knit pullover with subtle bell sleeves offers a stylish yet comfortable option for pairing or standalone wear.",
  "Add a touch of elegance to your wardrobe with this stylish printed mock neck long sleeved top. Perfect for any season this top combines comfort with chic design.",
  "Embrace cosy chic with this v-neck sweatshirt featuring drop shoulder sleeves and rib knit finishing. Its relaxed fit ensures comfort.",
  "Complete your ultimate wardrobe with our corduroy skirt where classic meets standout style. This piece redefines everyday versatility."
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

// Generate cool, customer-friendly titles that stay connected to the original
function generateCoolTitle(originalTitle, seoKeywords) {
  let title = originalTitle;
  
  // Remove problematic characters and terms
  title = title.replace(/&/g, '');  // Remove &
  title = title.replace(/scotch\s*soda/gi, '');  // Remove Scotch Soda
  title = title.replace(/sp\d+/gi, '');  // Remove Sp25, Sp24, etc.
  title = title.replace(/men['']?s/gi, '');  // Remove Men's, Men'S
  title = title.replace(/\([^)]*\)/g, '');  // Remove anything in parentheses like (Black/Green)
  title = title.replace(/\s*-\s*mainline\s*fashion/gi, '');  // Remove - Mainline Fashion
  title = title.replace(/\s*-\s*[^-]*fashion[^-]*/gi, '');  // Remove other fashion descriptors
  title = title.replace(/\d+pk/gi, (match) => {
    // Replace number packs with words
    const num = match.replace(/pk/gi, '');
    const replacements = { '2': 'Duo', '3': 'Trio', '4': 'Quad', '5': 'Five' };
    return replacements[num] || match;
  });
  
  // Clean up extra spaces
  title = title.replace(/\s+/g, ' ').trim();
  
  // Remove common stop words but keep descriptive words
  const stopWords = ['quantity', 'mainline', 'fashion', 'underwear'];
  const words = title.split(/\s+/).filter(word => {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    return cleanWord.length > 1 && !stopWords.includes(cleanWord);
  });
  
  // Take first 5 meaningful words and capitalize properly
  const finalWords = words.slice(0, 5).map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  
  let finalTitle = finalWords.join(' ');
  
  // If we end up with something too short or weird, use fallback
  if (finalTitle.split(' ').length < 2 || finalTitle.length < 5) {
    return truncateTitle(originalTitle);
  }
  
  return finalTitle;
}

function truncateTitle(text) {
  const stopWords = [
    'black', 'white', 'navy', 'green', 'grey', 'beige', 'red', 'blue', 
    'pack', '3-pack', '2-pack', 'mens', 'kids', 'women', "women's",
    'quantity', 'scotch', 'soda', 'scotch&soda', 'mainline', 'fashion',
    '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2pk', '3pk', '4pk', '5pk'
  ];
  return text
    .split(/\s+/)
    .filter(w => !stopWords.includes(w.toLowerCase()))
    .slice(0, 4)
    .join(' ');
}

function truncateDescription(text) {
  const words = text.split(/\s+/);
  if (words.length > 40) {
    return words.slice(0, 40).join(' ') + '...';
  }
  return text;
}

// Super dynamic prompt with multiple randomization layers
function buildPrompt(title, imageUrl) {
  // Shuffle and pick multiple random examples for more variety
  const shuffledExamples = AU_EXAMPLES.sort(() => 0.5 - Math.random());
  const randomExamples = shuffledExamples.slice(0, Math.floor(Math.random() * 3) + 2); // 2-4 examples
  
  const seoKeywords = extractSEOKeywords(title);
  
  // Random instruction approaches
  const approaches = [
    "Write a product description that feels fresh and unique. Focus on the experience of wearing this item.",
    "Create a compelling description that makes someone want to buy this. What makes it special?",
    "Describe this product like you're recommending it to a friend. What would you say?",
    "Write a description that captures the lifestyle and feeling this product represents.",
    "Focus on the benefits and what this product does for the wearer, not just features."
  ];
  
  const randomApproach = approaches[Math.floor(Math.random() * approaches.length)];
  
  // Random style directions
  const styleDirections = [
    "Use vivid, descriptive language that paints a picture.",
    "Keep it conversational and approachable.",
    "Be confident and bold in your language.",
    "Focus on emotions and feelings the product evokes.",
    "Mix technical details with lifestyle benefits."
  ];
  
  const randomStyle = styleDirections[Math.floor(Math.random() * styleDirections.length)];
  
  const instruction = `You are a creative product copywriter for a premium UK fashion brand.

${randomApproach} ${randomStyle}

Include these keywords naturally: ${seoKeywords.join(', ')}

Write 20-40 words that are completely unique and avoid these overused starts:
- "Crafted from" / "Crafted with"
- "Elevate your" / "Elevate"  
- "Discover" / "Experience"
- "Indulge in"
- "Embrace"

Get inspiration from these brand voice examples (but don't copy them):
${randomExamples.map(ex => `"${ex}"`).join('\n')}

Original Product: "${title}"

Write ONLY the product description - no title, no prefixes.`;

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
    let usingImage = false;
    
    // First try with image if URL provided
    if (imageUrl && imageUrl.trim() !== '') {
      try {
        usingImage = true;
        response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [buildPrompt(title, imageUrl)],
          max_tokens: 200,
          temperature: 0.8,
          top_p: 0.9
        });
      } catch (imageError) {
        console.warn(`Vision failed for "${title}": ${imageError.message}`);
        usingImage = false;
      }
    }
    
    // If no image or image failed, generate from title only
    if (!usingImage) {
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [buildPrompt(title, null)],
        max_tokens: 200,
        temperature: 0.8,
        top_p: 0.9
      });
    }

    const rawContent = response.choices[0].message.content;
    const description = parseResponse(rawContent, title);
    const seoKeywords = extractSEOKeywords(title);
    const formattedTitle = generateCoolTitle(title, seoKeywords);

    console.log('[→] Original:', title);
    console.log('[→] Using Image:', usingImage);
    console.log('[→] SEO Keywords:', seoKeywords.join(', '));
    console.log('[→] Cool Title:', formattedTitle);
    console.log('[→] Raw AI Response:', rawContent);
    console.log('[→] Final Description:', description);
    console.log('---');

    res.json({ formattedTitle, description });
  } catch (err) {
    console.error('Generation failed:', err);
    
    // Fallback: return a simple description based on title
    const seoKeywords = extractSEOKeywords(title);
    const fallbackDescription = `Experience quality and style with this ${seoKeywords.join(' ')} – designed for everyday wear and lasting comfort.`;
    const formattedTitle = generateCoolTitle(title, seoKeywords);
    
    console.log('[→] FALLBACK for:', title);
    console.log('[→] Fallback Description:', fallbackDescription);
    
    res.json({ 
      formattedTitle, 
      description: fallbackDescription,
      note: 'Generated with fallback due to API error'
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});