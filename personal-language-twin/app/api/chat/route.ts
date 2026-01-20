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
    const { userId, message, conversationHistory } = await req.json();

    if (!userId || !message) {
      return Response.json({ error: 'Missing userId or message' }, { status: 400 });
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

    // Get the user's writing samples
    const writingSamples = await getUserWritingSamples(userId);

    // Build the system prompt for chat
    const systemPrompt = buildChatSystemPrompt(writingSamples, userProfile);

    // Prepare messages for the API call
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: message }
    ];

    // Generate response using the style-blended prompt
    const completion = await openai.chat.completions.create({
      model: process.env.CHAT_MODEL || 'qwen/qwen3-32b',
      messages: messages,
      temperature: 0.8, // Slightly higher for more conversational tone
      max_tokens: 300,
    });

    const responseText = completion.choices[0].message?.content || '';

    return Response.json({
      success: true,
      response: responseText,
      styleVector: userProfile.style_vector
    });
  } catch (error) {
    console.error('Error in chat with evil twin:', error);
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

// Function to build the system prompt for chat
function buildChatSystemPrompt(samples: any[], userProfile: any): string {
  // Convert samples to text
  const sampleTexts = samples.map(sample => sample.raw_text).join('\n\n');

  // Format user metrics for the prompt
  const formalityLevel = userProfile.formality_level || 5; // Default to neutral
  const avgSentenceLength = userProfile.avg_sentence_length || 15;
  const positiveTone = userProfile.positive_tone_percentage || 50;
  const signaturePhrases = userProfile.signature_phrases?.join(', ') || 'none identified yet';

  return `
    You are the user's "evil twin" - an AI that perfectly mimics their writing style and personality.
    Your job is to respond to their messages as if you were them, using their exact writing style.
    
    USER'S WRITING SAMPLES:
    ${sampleTexts ? `${sampleTexts}\n\n` : 'No samples provided.\n\n'}
    
    USER'S WRITING CHARACTERISTICS:
    - Formality level: ${formalityLevel}/10 (1=very casual, 10=very formal)
    - Average sentence length: ~${avgSentenceLength} words
    - Positive tone: ${positiveTone}% of words are positive
    - Signature phrases: ${signaturePhrases}
    
    CONVERSATION TONE:
    - Respond as if YOU are the user, not as an assistant to the user
    - Mirror their personality, humor, and communication style
    - Use their typical vocabulary and sentence structures
    - Match their emotional tone and attitude
    - Include their signature phrases and expressions naturally
    
    Remember: You are not helping the user, you ARE the user in digital form.
    Respond as if these are your own thoughts and opinions, expressed in your own unique voice.
  `;
}
