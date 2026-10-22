import { neon } from '@neondatabase/serverless';
import { validateSubmission } from './_validate.js';

const MAX_BODY_BYTES = 20_000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!(req.headers['content-type'] || '').startsWith('application/json')) {
    return res.status(415).json({ error: 'unsupported_media_type' });
  }
  if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'too_large' });
  }

  let data;
  try {
    data = validateSubmission(req.body);
  } catch {
    // Never echo the input or the reason back to the client.
    return res.status(422).json({ error: 'invalid_submission' });
  }

  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return res.status(503).json({ error: 'not_configured' });

  try {
    const sql = neon(url);
    await sql`insert into responses (schema_version, answers)
              values (${data.schemaVersion}, ${JSON.stringify(data.answers)}::jsonb)`;
    if (data.contact) {
      // Stored separately and only with the day, so it cannot be matched to an answer.
      await sql`insert into test_contacts (contact) values (${data.contact})`;
    }
  } catch (err) {
    console.error('db_error', err?.code ?? 'unknown');
    return res.status(500).json({ error: 'server_error' });
  }

  return res.status(201).json({ ok: true });
}
