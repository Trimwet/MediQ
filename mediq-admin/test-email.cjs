const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env vars directly since dotenv might not be installed in the root
const envFile = fs.readFileSync('.env', 'utf8');
let url = '';
let key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
});

const supabaseAdmin = createClient(url, key);

async function testEmail() {
  console.log('Testing Supabase Email Delivery...');
  
  // Try to invite a dummy user to trigger the SMTP server
  const testEmail = 'mediq-test-delivery-' + Date.now() + '@example.com';
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(testEmail);
  
  if (error) {
    console.error('\n❌ FAILED! Supabase returned an error:');
    console.error(error);
  } else {
    console.log('\n✅ SUCCESS! Supabase accepted the request and sent the email to the SMTP server.');
    console.log('User ID created:', data.user.id);
    
    // Clean up the dummy user
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    console.log('Cleaned up dummy user.');
  }
}

testEmail();