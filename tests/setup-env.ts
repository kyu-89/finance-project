import { config } from 'dotenv';

// Integration tests need SUPABASE_SERVICE_ROLE_KEY; unit tests need nothing.
// Both files are gitignored — see .env.test.local.example for the template.
config({ path: '.env.test.local' });
config({ path: '.env.local' });
