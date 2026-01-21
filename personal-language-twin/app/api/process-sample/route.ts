import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

// Initialize OpenAI(well hackAI) client
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
    const { userId, rawText } = await req.json();

    if (!userId || !rawText) {
      return Response.json({ error: 'Missing userId or rawText' }, { status: 400 });
    }

    // Clean and chunk the text
    const cleanedText = cleanText(rawText);
    const chunks = chunkText(cleanedText, 512); // 512 tokens per chunk

    // Process each chunk to generate embeddings
    const embeddingPromises = chunks.map(async (chunk) => {
      const embeddingResponse = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL || 'qwen/qwen3-embedding-8b',
        input: chunk,
      });

      return {
        id: crypto.randomUUID(),
        user_id: userId, // This should be a valid UUID
        raw_text: chunk,
        embedding: embeddingResponse.data[0].embedding,
        metadata: {
          length: chunk.length,
          timestamp: new Date().toISOString(),
        },
      };
    });

    const embeddings = await Promise.all(embeddingPromises);

    // First ensure the user profile exists
    await initializeUserProfileIfNeeded(userId);

    // Insert embeddings into Supabase
    const { data, error } = await supabaseClient
      .from('writing_samples')
      .insert(embeddings)
      .select();

    if (error) {
      console.error('Error inserting embeddings:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details
      });
      return Response.json({
        error: 'Failed to store embeddings',
        details: {
          message: error.message,
          code: error.code,
          hint: error.hint
        }
      }, { status: 500 });
    }

    // Update the user's style vector
    await updateUserStyleVector(userId);

    // Also analyze text metrics
    const metrics = analyzeTextMetrics(rawText);

    // Update user profile with metrics
    await updateUserMetrics(userId, metrics);

    return Response.json({
      success: true,
      count: embeddings.length,
      metrics: metrics
    });
  } catch (error) {
    console.error('Error processing writing sample:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to clean text
function cleanText(text: string): string {
  // Remove extra whitespace, normalize line breaks
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

// Helper function to chunk text
function chunkText(text: string, maxLength: number): string[] {
  const sentences = text.match(/[^\.!?]+[\.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        // If a single sentence is too long, split it by length
        const sentenceChunks = splitByLength(sentence, maxLength);
        chunks.push(...sentenceChunks);
      }
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Helper function to split text by length if needed
function splitByLength(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
}

// Function to update user's style vector
async function updateUserStyleVector(userId: string) {
  // Get all embeddings for the user
  const { data: samples, error } = await supabaseClient
    .from('writing_samples')
    .select('embedding')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user embeddings:', error);
    return;
  }

  if (!samples || samples.length === 0) {
    return;
  }

  // Calculate the average embedding
  const avgEmbedding = calculateAverageEmbedding(samples.map(s => s.embedding));

  // Update the user's profile with the style vector
  const { error: updateError } = await supabaseClient
    .from('user_profiles')
    .update({ style_vector: avgEmbedding })
    .eq('id', userId);

  if (updateError) {
    console.error('Error updating user style vector:', updateError);
  }
}

// Helper function to calculate average embedding
function calculateAverageEmbedding(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];

  const dimensions = embeddings[0].length;
  const avgEmbedding = new Array(dimensions).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dimensions; i++) {
      avgEmbedding[i] += embedding[i];
    }
  }

  for (let i = 0; i < dimensions; i++) {
    avgEmbedding[i] /= embeddings.length;
  }

  return avgEmbedding;
}

// Function to analyze text metrics
function analyzeTextMetrics(text: string) {
  // Count sentences
  const sentenceCount = (text.match(/[.!?]+/g) || []).length;

  // Count words
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;

  // Calculate average sentence length
  const avgSentenceLength = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;

  // Count unique words
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const uniqueWords = new Set(words).size;

  // Analyze sentiment (simple heuristic)
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'enjoy', 'happy', 'pleased', 'satisfied'];
  const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'sad', 'angry', 'frustrated', 'disappointed'];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of words) {
    if (positiveWords.includes(word)) positiveCount++;
    if (negativeWords.includes(word)) negativeCount++;
  }

  const positiveTone = wordCount > 0 ? Math.round((positiveCount / wordCount) * 100) : 0;

  // Detect formality level (simple heuristic)
  const formalMarkers = ['regarding', 'concerning', 'pursuant', 'herewith', 'whereas', 'therefore', 'moreover', 'furthermore', 'nevertheless'];
  const informalMarkers = ['gonna', 'wanna', 'kinda', 'sorta', 'y\'all', 'dude', 'cool', 'awesome', 'totally', 'basically'];

  let formalityScore = 0;
  for (const word of words) {
    if (formalMarkers.includes(word)) formalityScore++;
    if (informalMarkers.includes(word)) formalityScore--;
  }

  // Normalize formality score to 0-10 scale
  const formalityLevel = Math.max(0, Math.min(10, 5 + (formalityScore / Math.max(1, wordCount / 100))));

  // Find common phrases
  const phrases = findCommonPhrases(text);

  return {
    avgSentenceLength,
    uniqueWords,
    positiveTone,
    formalityLevel,
    commonPhrases: phrases.slice(0, 5) // Top 5 phrases
  };
}

// Function to find common phrases in text
function findCommonPhrases(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const phraseCounts: Record<string, number> = {};

  for (const sentence of sentences) {
    const words = sentence.toLowerCase().match(/\b\w+\b/g) || [];

    // Look for 2-3 word phrases
    for (let i = 0; i < words.length - 1; i++) {
      const phrase2 = words.slice(i, i + 2).join(' ');
      phraseCounts[phrase2] = (phraseCounts[phrase2] || 0) + 1;

      if (i < words.length - 2) {
        const phrase3 = words.slice(i, i + 3).join(' ');
        phraseCounts[phrase3] = (phraseCounts[phrase3] || 0) + 1;
      }
    }
  }

  // Sort phrases by frequency and return top ones
  return Object.entries(phraseCounts)
    .filter(([_, count]) => count > 1) // Only phrases that appear more than once
    .sort((a, b) => b[1] - a[1])
    .map(([phrase, _]) => phrase.charAt(0).toUpperCase() + phrase.slice(1));
}

// Function to initialize user profile if it doesn't exist
async function initializeUserProfileIfNeeded(userId: string) {
  // Check if the user profile already exists
  const { data: existingProfile, error: selectError } = await supabaseClient
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (selectError && selectError.code === 'PGRST116') { // Row not found
    // Create a new user profile with default values
    const { error: insertError } = await supabaseClient
      .from('user_profiles')
      .insert([{
        id: userId,
        formality_level: 0,
        avg_sentence_length: 0,
        unique_words_count: 0,
        positive_tone_percentage: 0,
        signature_phrases: [],
        style_vector: null
      }]);

    if (insertError) {
      console.error('Error creating initial user profile:', insertError);
    }
  } else if (selectError) {
    console.error('Error checking user profile existence:', selectError);
  }
}

// Function to update user metrics
async function updateUserMetrics(userId: string, metrics: any) {
  // First, check if the user profile exists
  const { data: existingProfile, error: selectError } = await supabaseClient
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (selectError && selectError.code !== 'PGRST116') { // PGRST116 is "Row not found"
    console.error('Error checking user profile:', selectError);
    return;
  }

  if (existingProfile) {
    // Update existing profile
    const { error } = await supabaseClient
      .from('user_profiles')
      .update({
        formality_level: metrics.formalityLevel,
        avg_sentence_length: metrics.avgSentenceLength,
        unique_words_count: metrics.uniqueWords,
        positive_tone_percentage: metrics.positiveTone,
        signature_phrases: metrics.commonPhrases
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user metrics:', error);
    }
  } else {
    // Insert new profile
    const { error } = await supabaseClient
      .from('user_profiles')
      .insert([{
        id: userId,
        formality_level: metrics.formalityLevel,
        avg_sentence_length: metrics.avgSentenceLength,
        unique_words_count: metrics.uniqueWords,
        positive_tone_percentage: metrics.positiveTone,
        signature_phrases: metrics.commonPhrases
      }]);

    if (error) {
      console.error('Error creating user profile:', error);
    }
  }
}