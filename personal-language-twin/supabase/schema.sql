CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,  -- Changed from UUID to TEXT to accept string IDs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  formality_level DECIMAL(3,2) DEFAULT 0,
  avg_sentence_length INTEGER DEFAULT 0,
  unique_words_count INTEGER DEFAULT 0,
  positive_tone_percentage DECIMAL(5,2) DEFAULT 0,
  signature_phrases TEXT[],
  style_vector VECTOR(4096)
);

CREATE TABLE IF NOT EXISTS writing_samples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT REFERENCES user_profiles(id),  -- Changed from UUID to TEXT
  raw_text TEXT NOT NULL,
  embedding VECTOR(4096),
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS generation_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT REFERENCES user_profiles(id),  -- Changed from UUID to TEXT
  input_prompt TEXT NOT NULL,
  generated_output TEXT NOT NULL
);
