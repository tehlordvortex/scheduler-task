create or replace function notify_booking_changed()
returns trigger
as $$
begin
  perform pg_notify('booking_changed', '');
  return new;
end
$$
language plpgsql;

create trigger "notify_on_change" after insert or update on "booking"
for each statement execute procedure notify_booking_changed();
