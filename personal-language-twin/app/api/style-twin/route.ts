import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

// Initialize hackclub OpenAI client
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
    const { userId, prompt } = await req.json();

    if (!userId || !prompt) {
      return Response.json({ error: 'Missing userId or prompt' }, { status: 400 });
    }

    // Get the user's style vector
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('style_vector')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return Response.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get the top 10 most similar writing samples to the style
    const similarSamples = await getSimilarSamples(userId, userProfile.style_vector, 10);

    // Build the system prompt with style context
    const systemPrompt = buildSystemPrompt(similarSamples, userProfile.style_vector);

    // Generate text using the style-blended prompt
    const completion = await openai.chat.completions.create({
      model: 'qwen/qwen3-32b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500, // Probably need to configure this based on the use case
    });

    const generatedText = completion.choices[0].message.content;

    // Log the generation to history
    await logGenerationHistory(userId, prompt, generatedText);

    return Response.json({ 
      success: true, 
      generatedText,
      styleVector: userProfile.style_vector
    });
  } catch (error) {
    console.error('Error in style twin generation:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Function to get similar samples based on embedding similarity
async function getSimilarSamples(userId: string, styleVector: number[], limit: number) {
  // In a real implementation, we would use pgvector to find similar embeddings
  // For now, we'll simulate this by fetching random samples
  const { data: samples, error } = await supabaseClient
    .from('writing_samples')
    .select('raw_text')
    .eq('user_id', userId)
    .limit(limit);

  if (error) {
    console.error('Error fetching similar samples:', error);
    return [];
  }

  return samples || [];
}

// Function to build the system prompt with style context
function buildSystemPrompt(similarSamples: any[], styleVector: number[]): string {
  // Convert similar samples to text
  const sampleTexts = similarSamples.map(sample => sample.raw_text).join('\n\n');
  
  return `
    You are a writing engine that must produce text in the exact style of the user.
    Here is the user's style vector context:
    ${sampleTexts ? `SAMPLES:\n${sampleTexts}\n\n` : ''}
    
    Here are key characteristics derived from the user's writing:
    - Maintain similar formality level
    - Use comparable sentence structures
    - Match vocabulary complexity
    - Preserve rhythm and tone
    - Follow similar punctuation patterns
    
    You must use tone, sentence structure, vocabulary, and rhythm similar to the user.
    The output should feel like it was written exactly like the same person.
  `;
}

// Function to log generation history
async function logGenerationHistory(userId: string, input: string, output: string) {
  const { error } = await supabaseClient
    .from('generation_history')
    .insert([{
      id: crypto.randomUUID(),
      user_id: userId,
      input_prompt: input,
      generated_output: output,
      timestamp: new Date().toISOString()
    }]);

  if (error) {
    console.error('Error logging generation history:', error);
  }
}