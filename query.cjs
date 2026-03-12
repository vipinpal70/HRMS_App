const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const { createClient } = require('@supabase/supabase-js');

const dbUrlMatch = env.match(/DATABASE_URL=["']?(postgres.*?)["']?($|\n)/);
if (!dbUrlMatch) {
  console.log('No DATABASE_URL found');
  process.exit(1);
}
const dbUrl = dbUrlMatch[1].trim();

const { Client } = require('pg');
const client = new Client({ connectionString: dbUrl });

client.connect()
  .then(() => client.query("SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user'"))
  .then(res => {
    console.log(res.rows[0]?.prosrc || 'Function not found');
    return client.end();
  })
  .catch(err => {
    console.error(err);
    client.end();
  });
