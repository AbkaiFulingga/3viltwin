const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function migrate() {
  console.log('Starting database setup instructions');

  // Read .env.local file directly to get environment variables
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found in project root');
    process.exit(1);
  }

  const envData = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envData.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.join('=').trim();
      }
    }
  });

  const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseAnonKey = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const supabaseServiceRoleKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables in .env.local');
    console.error('Make sure you have NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  if (!supabaseServiceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
    console.log('This is needed for database migrations. Get it from your Supabase dashboard:');
    console.log('Project Settings → API → Service Role Key');
  }

  console.log('Environment variables are set correctly');

  // Test the connection with anon key (for basic connectivity)
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Try a simple query to test connection
  try {
    const { error: testError } = await supabase.from('user_profiles').select('id').limit(1);
    
    if (testError && testError.code === '42P01') { // Undefined table error
      console.log('\n Database tables not found!');
      console.log('You need to set up your database schema.');
      console.log('\nPlease follow these steps:');
      console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/[your-project-id]');
      console.log('2. Navigate to SQL Editor (in the sidebar)');
      console.log('3. Copy the content from supabase/schema.sql file');
      console.log('4. Paste it in the SQL editor and click "RUN"');
      console.log('\nThe schema file contains:');
      console.log('- user_profiles table');
      console.log('- writing_samples table');
      console.log('- generation_history table');
      console.log('- vector extension for embeddings');
    } else if (testError) {
      console.log('\nConnection test failed:', testError.message);
    } else {
      console.log('\nDatabase connection is working and tables exist!');
      console.log('Your application should now work properly.');
    }
  } catch (error) {
    console.log('\nCould not test database connection:', error.message);
  }

  console.log('\n💡 Tip: If you want to use the Supabase CLI for migrations:');
  console.log('1. Install Supabase CLI: https://supabase.com/docs/guides/cli/getting-started');
  console.log('2. Run: supabase login');
  console.log('3. Run: supabase link --project-ref [your-project-ref]');
  console.log('4. Run: supabase db push');
}

migrate().catch(console.error);