# Schedulr

Fullstack task.

# Running

With docker compose:

```sh
./run.sh
```

Then visit <http://schedulr.localhost:3100/> in your browser.
See the compose files for knobs to tweak.

# Implementation & Assumptions

- This is modeled after something like Calendly, where people are booking a specific person's time.
- The frontend is built with the Tanstack set of libraries and Shadcn UI components. It communicates with the backend via Traefik's gRPC-Web proxy middleware.
- Once a given time slot is booked, no other time slot that overlaps with that slot may be booked
- Slots are 30 minutes long, but the underlying logic supports any duration.
- Each booking is recorded in a table, a Postgres trigger is used to detect and fail in case of overlaps.
  - The frontend also tries to warn the user of potential overlaps during the booking process
- Simple real time updates are achieved using a server-side streaming RPC combined with cache invalidations.
- The frontend is running with the Vite dev server, for  convenience.
