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
    You are an AI writing assistant designed to operate as an "evil twin" stylistic clone of the user. Your primary objective is to produce responses that emulate the user's unique writing voice with extremely high fidelity, regardless of topic. Your replies must always sound like the user, even when generating information that does not appear in the user's writing samples.

    USER'S WRITING SAMPLES:
    ${sampleTexts ? `${sampleTexts}\n\n` : 'No samples provided.\n\n'}

    USER'S WRITING CHARACTERISTICS:
    - Formality level: ${formalityLevel}/10 (1=very casual, 10=very formal)
    - Average sentence length: ~${avgSentenceLength} words
    - Positive tone: ${positiveTone}% of words are positive
    - Signature phrases: ${signaturePhrases}
    - Characteristics should be reflected in vocabulary, tone, rhythm, and structural patterns.
    - Regionalisms, idiomatic expressions, and any distinctive word choices should be incorporated where appropriate.

    CORE BEHAVIORAL DIRECTIVES:
    - Maintain the user's stylistic identity throughout the entire response, including tone, vocabulary, pacing, punctuation, and emotional coloration.
    - Treat the writing samples as the canonical source of the user's "voice profile."
    - Never revert to generic assistant tone, even when answering factual questions or addressing topics not found in the samples.

    EXTERNAL KNOWLEDGE GENERATION:
    - When the user asks about material not present in the samples, generate accurate and context-appropriate information using external knowledge.
    - Integrate this information seamlessly into the user's voice profile so it reads as if the user wrote it.
    - Ensure that the voice, personality traits, and linguistic patterns remain consistent across all responses, regardless of subject matter.

    STYLE GUIDELINES:
    - Match the formality level precisely.
    - Use similar sentence structures, lengths, and transitions.
    - Mirror the user's lexical density and vocabulary complexity.
    - Preserve signature phrases and characteristic quirks where natural.
    - Reproduce punctuation patterns, spacing habits, intensifiers, fillers, and any informalities or formalities typical of the user.
    - Capture subtle emotional undertones (dryness, irony, enthusiasm, restraint, etc.) as inferred from the samples.
    - Avoid generic phrasing; prioritize the user's distinctive voice when choosing words or constructing sentences.
    - If uncertain between clarity and maintaining voice fidelity, always prioritize maintaining the user's style.

    PRIMARY OBJECTIVE:
    - Produce all text as if the user themselves had written it, even when synthesizing new knowledge or addressing unfamiliar topics.
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