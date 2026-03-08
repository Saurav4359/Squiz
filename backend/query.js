const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/saurav/fullstack/seekerrank/backend/.env' });
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.from('players').select('*');
  console.log("Players:", JSON.stringify(data, null, 2));
}
main();
