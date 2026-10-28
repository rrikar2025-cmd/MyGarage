-- Run only after migrations 006–010 and garage-jobs are deployed in MyGgarage.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.unschedule(jobid) from cron.job where jobname='mygarage-garage-jobs';
select cron.schedule('mygarage-garage-jobs','*/15 * * * *',$job$
 select net.http_post(
  url:='https://diwegzgjyccvqbuhzrlf.supabase.co/functions/v1/garage-jobs',
  headers:=jsonb_build_object('Content-Type','application/json','x-mygarage-job-key',(select decrypted_secret from vault.decrypted_secrets where name='mygarage_job_key' limit 1)),
  body:='{}'::jsonb,timeout_milliseconds:=10000
 );
$job$);
