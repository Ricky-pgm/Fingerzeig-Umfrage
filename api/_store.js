import { neon } from '@neondatabase/serverless';

// One statement, so a response and its contact are stored together or not at all.
// A repeated submission_id inserts nothing and reports 0 rows (a retry after a lost reply).
export function neonStore(url) {
  const sql = neon(url);
  return async function save(data) {
    const rows = await sql`
      with ins as (
        insert into responses (submission_id, schema_version, duration_s, answers)
        values (${data.submissionId}::uuid, ${data.schemaVersion}, ${data.durationS}, ${JSON.stringify(data.answers)}::jsonb)
        on conflict (submission_id) do nothing
        returning id
      ), contact as (
        insert into test_contacts (contact)
        select ${data.contact}::text from ins where ${data.contact}::text <> ''
      )
      select count(*)::int as inserted from ins`;
    return rows[0].inserted === 1;
  };
}
