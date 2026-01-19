import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

// Initialize hackclub AI
const openai = new OpenAI({
  baseURL: 'https://ai.hackclub.com/proxy/v1',
  apiKey: 'sk-hc-v1-6f2c16af985545bea904dc0c86a09898e28b95c5d60141aa90b5beda0334b0c1',
});

// Initialize our Supabase client
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
        model: 'qwen/qwen3-embedding-8b',
        input: chunk,
      });

      return {
        id: crypto.randomUUID(),
        user_id: userId,
        raw_text: chunk,
        embedding: embeddingResponse.data[0].embedding,
        metadata: {
          length: chunk.length,
          timestamp: new Date().toISOString(),
        },
      };
    });

    const embeddings = await Promise.all(embeddingPromises);

    // Insert embeddings into Supabase
    const { data, error } = await supabaseClient
      .from('writing_samples')
      .insert(embeddings)
      .select();

    if (error) {
      console.error('Error inserting embeddings:', error);
      return Response.json({ error: 'Failed to store embeddings' }, { status: 500 });
    }

    // Update the user's style vector
    await updateUserStyleVector(userId);

    return Response.json({ success: true, count: embeddings.length });
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