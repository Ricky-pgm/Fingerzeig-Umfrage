import { validateSubmission } from './_validate.js';
import { databaseUrl } from './_env.js';
import { neonStore } from './_store.js';

const MAX_BODY_BYTES = 20_000;

export function createHandler(getStore) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    if (!(req.headers['content-type'] || '').startsWith('application/json')) {
      return res.status(415).json({ error: 'unsupported_media_type' });
    }
    // The header can be missing or wrong (chunked uploads), so the parsed body is measured as well.
    if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES
      || Buffer.byteLength(JSON.stringify(req.body ?? null)) > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'too_large' });
    }

    let data;
    try {
      data = validateSubmission(req.body);
    } catch {
      // Never echo the input or the reason back to the client.
      return res.status(422).json({ error: 'invalid_submission' });
    }

    const store = getStore();
    if (!store) return res.status(503).json({ error: 'not_configured' });

    try {
      const created = await store(data);
      return res.status(created ? 201 : 200).json({ ok: true });
    } catch (err) {
      console.error('db_error', err?.code ?? 'unknown');
      return res.status(500).json({ error: 'server_error' });
    }
  };
}

export default createHandler(() => {
  const url = databaseUrl();
  return url ? neonStore(url) : null;
});
