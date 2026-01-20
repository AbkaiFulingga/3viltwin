require('dotenv').config(); // Load environment variables

const { OpenAI } = require('openai');

console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('Base URL:', process.env.OPENAI_BASE_URL || 'https://ai.hackclub.com/proxy/v1');

// Initialize hackAI client
const openai = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || 'https://ai.hackclub.com/proxy/v1',
  apiKey: process.env.OPENAI_API_KEY,
});

async function testEmbedding() {
  try {
    console.log('Testing embedding API...');
    const embeddingResponse = await openai.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'qwen/qwen3-embedding-8b',
      input: "This is a test",
    });

    const embedding = embeddingResponse.data[0].embedding;
    console.log(`Embedding dimensions: ${embedding.length}`);
    console.log(`First 10 values: [${embedding.slice(0, 10).join(', ')}...]`);
    
    // Check if it matches the expected 1536 dimensions
    if (embedding.length === 1536) {
      console.log('✅ Embedding has correct dimensions (1536)');
    } else {
      console.log(`❌ Embedding has ${embedding.length} dimensions, expected 1536`);
    }
  } catch (error) {
    console.error('Error testing embedding:', error.message);
  }
}

testEmbedding();