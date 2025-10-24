create table "booking" (
  "id" text not null primary key default typeid_generate_text('boo'),
  "title" text not null,
  "scheduled_for" timestamptz not null,
  "ends_at" timestamptz not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "deleted_at" timestamptz,
  unique ("scheduled_for", "ends_at"),
  constraint typeid_pk check (typeid_check_text(id, 'boo')),
  constraint scheduled_for_utc check (extract(timezone from scheduled_for) = '0'),
  constraint created_at_utc check (extract(timezone from created_at) = '0'),
  constraint updated_at_utc check (extract(timezone from updated_at) = '0'),
  constraint deleted_at_utc check (extract(timezone from deleted_at) = '0')
);

create or replace function check_booking_overlap()
returns trigger
as $$
begin
if exists (
  select 1 from "booking"
  where greatest(new.scheduled_for, "booking".scheduled_for) < least(new.ends_at, "booking".ends_at)
) then
  raise exception 'booking_overlap';
else
  return new;
end if;
end
$$
language plpgsql;

create trigger "check_overlap" before insert on "booking"
for each row execute procedure check_booking_overlap();
