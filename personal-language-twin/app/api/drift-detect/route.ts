import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || 'https://ai.hackclub.com/proxy/v1',
  apiKey: process.env.OPENAI_API_KEY!,
});

// Initialize Supabase client with service role key for full access
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for admin operations
);

export async function POST(req: NextRequest) {
  try {
    const { userId, generatedText } = await req.json();

    if (!userId || !generatedText) {
      return Response.json({ error: 'Missing userId or generatedText' }, { status: 400 });
    }

    // Get the user's style vector and metrics
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('style_vector, formality_level, avg_sentence_length, unique_words_count, positive_tone_percentage, signature_phrases')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile || !userProfile.style_vector) {
      return Response.json({ error: 'User profile or style vector not found' }, { status: 404 });
    }

    // Generate embedding for the generated text
    const embeddingResponse = await openai.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'qwen/qwen3-embedding-8b',
      input: generatedText,
    });

    const generatedTextEmbedding = embeddingResponse.data[0].embedding;

    // Calculate cosine similarity with user's style vector
    const cosineSimilarity = calculateCosineSimilarity(
      generatedTextEmbedding,
      userProfile.style_vector
    );

    // Determine drift level based on similarity score
    let driftLevel = '';
    if (cosineSimilarity >= 0.85) {
      driftLevel = 'low'; // Good match
    } else if (cosineSimilarity >= 0.75) {
      driftLevel = 'medium'; // Moderate drift
    } else {
      driftLevel = 'high'; // High drift
    }

    return Response.json({
      success: true,
      driftScore: cosineSimilarity,
      driftLevel,
      similarityPercentage: Math.round(cosineSimilarity * 100)
    });
  } catch (error) {
    console.error('Error in drift detection:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Function to calculate cosine similarity between two vectors
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0; // If one vector is zero, similarity is 0
  }

  return dotProduct / (magnitudeA * magnitudeB);
}
