 -- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- To create user_profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  style_vector VECTOR(1536) -- Using 1536 dimensions for OpenAI embeddings
);

-- Create writing_samples table
CREATE TABLE writing_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL, -- Store the embedding vector
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a generation_history table
CREATE TABLE generation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  input_prompt TEXT NOT NULL,
  generated_output TEXT NOT NULL,
  drift_score FLOAT, -- Score from drift detection (0.0 to 1.0)
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance of the system
CREATE INDEX idx_writing_samples_user_id ON writing_samples(user_id);
CREATE INDEX idx_writing_samples_embedding ON writing_samples USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_generation_history_user_id ON generation_history(user_id);
CREATE INDEX idx_generation_history_timestamp ON generation_history(timestamp);

-- Enabled Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own samples" ON writing_samples
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own samples" ON writing_samples
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generation history" ON generation_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own generation history" ON generation_history
  FOR SELECT USING (auth.uid() = user_id);