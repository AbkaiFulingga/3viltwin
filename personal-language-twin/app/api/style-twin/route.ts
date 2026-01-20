import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

// Initialize hackAI client
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
    const { userId, prompt } = await req.json();

    if (!userId || !prompt) {
      return Response.json({ error: 'Missing userId or prompt' }, { status: 400 });
    }

    // Get the user's style vector and metrics
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('style_vector, formality_level, avg_sentence_length, unique_words_count, positive_tone_percentage, signature_phrases')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return Response.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get the users writing samples
    const writingSamples = await getUserWritingSamples(userId);

    // Build the system prompt with style context
    const systemPrompt = buildSystemPrompt(writingSamples, userProfile);

    // Generate text using the style-blended prompt
    const completion = await openai.chat.completions.create({
      model: process.env.GENERATION_MODEL || 'qwen/qwen3-32b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const generatedText = completion.choices[0].message?.content || '';

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

// Function to get user's writing samples
async function getUserWritingSamples(userId: string) {
  const { data: samples, error } = await supabaseClient
    .from('writing_samples')
    .select('raw_text')
    .eq('user_id', userId)
    .order('created_at', { ascending: false }) // Get most recent samples first
    .limit(10);

  if (error) {
    console.error('Error fetching user samples:', error);
    return [];
  }

  return samples || [];
}

// Function to build the system prompt with style context
function buildSystemPrompt(samples: any[], userProfile: any): string {
  // Convert samples to text
  const sampleTexts = samples.map(sample => sample.raw_text).join('\n\n');

  // Format user metrics for the prompt
  const formalityLevel = userProfile.formality_level || 5; // Default to neutral
  const avgSentenceLength = userProfile.avg_sentence_length || 15;
  const positiveTone = userProfile.positive_tone_percentage || 50;
  const signaturePhrases = userProfile.signature_phrases?.join(', ') || 'none identified yet';

  return `
    You are an AI writing assistant that must produce text in the exact style of the user.

    USER'S WRITING SAMPLES:
    ${sampleTexts ? `${sampleTexts}\n\n` : 'No samples provided.\n\n'}

    USER'S WRITING CHARACTERISTICS:
    - Formality level: ${formalityLevel}/10 (1=very casual, 10=very formal)
    - Average sentence length: ~${avgSentenceLength} words
    - Positive tone: ${positiveTone}% of words are positive
    - Signature phrases: ${signaturePhrases}

    STYLE GUIDELINES:
    - Match the formality level of the user
    - Use similar sentence structures and lengths
    - Include similar vocabulary complexity
    - Maintain the same rhythm and tone
    - Use similar punctuation patterns
    - Include signature phrases when appropriate

    Generate text that feels like it was written by the same person.
    The output should be indistinguishable from the user's own writing.
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