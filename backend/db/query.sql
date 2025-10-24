-- name: GetBookingById :one
select * from booking where id = $1 and deleted_at is null limit 1;

-- name: DeleteBookingById :exec
update booking set deleted_at = now() where id = $1 and deleted_at is null;

-- name: InsertBooking :one
insert into booking
  ("title", "scheduled_for", "ends_at")
values
  ($1, $2, $3)
returning *;

-- name: ListBookings :many
select * from booking where
  deleted_at is null
  and (scheduled_for > sqlc.narg(cursor)::timestamptz or sqlc.narg(cursor) is null)
  and (ends_at <= sqlc.narg(before)::timestamptz or sqlc.narg(before)::timestamptz is null)
  and (scheduled_for >= sqlc.narg(after)::timestamptz or sqlc.narg(after)::timestamptz is null)
order by scheduled_for asc limit @max;
