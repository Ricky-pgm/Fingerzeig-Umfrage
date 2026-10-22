-- Contacts keep no date any more (a day plus the response time could link a contact to an answer),
-- and two views for the evaluation. Run once in the Neon SQL editor after 001.

alter table test_contacts drop column if exists created_on;

-- Duration in minutes. Answers over one hour are left out (tab left open).
create or replace view v_duration as
select count(*)                                                 as n,
       round((percentile_cont(0.5) within group (order by duration_s) / 60)::numeric, 1) as median_min,
       round((avg(duration_s) / 60)::numeric, 1)                as mean_min,
       round((min(duration_s) / 60.0)::numeric, 1)              as min_min,
       round((max(duration_s) / 60.0)::numeric, 1)              as max_min
from responses
where duration_s <= 3600;

-- Fit and ease (1 to 5) per action.
create or replace view v_ratings as
select action,
       count(*)                as n,
       round(avg(fit), 2)      as fit_mean,
       round(avg(ease), 2)     as ease_mean
from v_gestures
group by action
order by action;
