-- Fingerzeig Umfrage: einmal im SQL-Editor von Neon ausführen.

create table if not exists responses (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  schema_version smallint not null check (schema_version >= 1),
  submission_id  uuid not null unique,
  duration_s     integer not null check (duration_s between 0 and 86400),
  answers        jsonb not null check (jsonb_typeof(answers) = 'object')
);

-- Manuelle Codierung von „Andere“-Antworten: gleiche Geste = gleicher Code.
create table if not exists gesture_codes (
  response_id uuid not null references responses (id) on delete cascade,
  action      text not null,
  code        text not null check (char_length(code) between 1 and 80),
  primary key (response_id, action)
);

-- Freiwillige Kontaktangaben für spätere Tests. Absichtlich ohne Bezug zu
-- einer Antwort und nur mit Tagesdatum, damit sie nicht zuordenbar sind.
create table if not exists test_contacts (
  id         uuid primary key default gen_random_uuid(),
  created_on date not null default current_date,
  contact    text not null check (char_length(contact) between 3 and 120)
);

-- Eine Zeile je vorgeschlagener Geste, bereit für die Auswertung.
create or replace view v_gestures as
select r.id                       as response_id,
       r.created_at,
       g ->> 'action'             as action,
       (g ->> 'position')::int    as position,
       g ->> 'hand'               as hand_shape,
       g ->> 'motion'             as motion,
       case when g ->> 'hand' = 'other' or g ->> 'motion' = 'other'
            then coalesce(c.code, 'other:' || r.id || ':' || (g ->> 'action'))
            else (g ->> 'hand') || ' + ' || (g ->> 'motion')
       end                        as gesture_code,
       nullif(g ->> 'note', '')   as note,
       (g ->> 'fit')::int         as fit,
       (g ->> 'ease')::int        as ease
from responses r
cross join lateral jsonb_array_elements(r.answers -> 'gestures') as g
left join gesture_codes c on c.response_id = r.id and c.action = g ->> 'action';

create or replace view v_gesture_counts as
select action, gesture_code, count(*) as n
from v_gestures
group by action, gesture_code
order by action, n desc;

create or replace view v_agreement as
with per_action as (
  select action, sum(n) as total, sum(n * n) as sq
  from v_gesture_counts
  group by action
)
select action,
       total as proposals,
       case when total > 1
            then round((total::numeric / (total - 1)) * (sq::numeric / (total * total)) - 1.0 / (total - 1), 3)
       end as agreement_rate
from per_action
order by action;
