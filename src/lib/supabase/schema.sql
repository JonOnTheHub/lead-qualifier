-- Intake schema. Reflects the live database as of the approval-flow migration.

create table if not exists leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),

  -- submission
  name            text not null,
  email           text not null,
  company         text not null,
  budget          text not null,
  timeline        text not null,
  message         text not null,

  -- AI output
  classification  text check (classification in ('hot','warm','cold','unqualified')),
  confidence      numeric,
  reasoning       text,
  intent          text,
  needs           text[],
  sentiment       text check (sentiment in ('positive','neutral','negative','urgent')),
  urgency_score   integer,
  tone_notes      text,
  email_subject   text,
  email_body      text,

  -- delivery
  email_sent      boolean default false,
  slack_notified  boolean default false,

  -- review flow
  status          text not null default 'pending_review'
                  check (status in ('pending_review','sending','sent','rejected','send_failed')),
  reviewed_at     timestamptz,
  send_error      text
);

create index if not exists leads_created_at_idx     on leads (created_at desc);
create index if not exists leads_classification_idx on leads (classification);
create index if not exists leads_status_idx         on leads (status);

create table if not exists usage_logs (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz default now(),
  lead_id            uuid references leads(id) on delete cascade,
  model              text not null,
  prompt_tokens      integer,
  completion_tokens  integer,
  total_tokens       integer,
  turn               integer,
  latency_ms         integer
);

create index if not exists usage_logs_created_at_idx on usage_logs (created_at desc);

alter table leads      enable row level security;
alter table usage_logs enable row level security;