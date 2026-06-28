import { config } from 'dotenv';
config();

const url = process.env.SUPABASE_URL + '/rest/v1/rpc/try_advisory_lock';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('KEY length:', key?.length);

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lock_id: 777888 }),
  });
  console.log('HTTP status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
} catch (err) {
  console.error('ERRO:', err.cause ?? err.message);
}
