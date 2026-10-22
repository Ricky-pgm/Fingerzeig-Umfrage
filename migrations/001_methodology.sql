-- Schema version 2: submission id (duplicates), duration, ratings per gesture, unique "other" codes.
-- Run once in the Neon SQL editor. Empty the tables first, old rows have no submission id:
--   delete from responses; delete from test_contacts;

alter table responses
  add column submission_id uuid not null,
  add column duration_s    integer not null check (duration_s between 0 and 86400);

alter table responses add constraint responses_submission_id_key unique (submission_id);

-- Manual coding of "other" answers: two answers that mean the same gesture get the same code here.
create table if not exists gesture_codes (
  response_id uuid not null references responses (id) on delete cascade,
  action      text not null,
  code        text not null check (char_length(code) between 1 and 80),
  primary key (response_id, action)
);

drop view if exists v_agreement;
drop view if exists v_gesture_counts;
drop view if exists v_gestures;

create view v_gestures as
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

create view v_gesture_counts as
select action, gesture_code, count(*) as n
from v_gestures
group by action, gesture_code
order by action, n desc;

create view v_agreement as
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
