package db

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migrate_pgx "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	pgx_stdlib "github.com/jackc/pgx/v5/stdlib"
)

var (
	databaseURL     = os.Getenv("DATABASE_URL")
	databaseVersion = os.Getenv("DATABASE_VERSION")

	ErrBookingOverlap = errors.New("bookings would overlap")
	ErrNotFound       = errors.New("not found")
)

//go:embed migrations
var migrationFs embed.FS

func Connect(ctx context.Context) (*Dal, error) {
	pgxConf, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	pgxConf.ConnConfig.RuntimeParams["timezone"] = "UTC"

	pool, err := pgxpool.NewWithConfig(ctx, pgxConf)
	if err != nil {
		return nil, err
	}

	source, err := iofs.New(migrationFs, "migrations")
	if err != nil {
		pool.Close()
		return nil, err
	}

	sqlDB := pgx_stdlib.OpenDBFromPool(pool)
	defer sqlDB.Close()

	driver, err := migrate_pgx.WithInstance(sqlDB, &migrate_pgx.Config{})
	if err != nil {
		pool.Close()
		return nil, err
	}

	migrations, err := migrate.NewWithInstance("migrations", source, "postgres", driver)
	if err != nil {
		pool.Close()
		return nil, err
	}

	versionStr := databaseVersion
	if versionStr == "" {
		versionStr = "0"
	}

	version, err := strconv.ParseUint(versionStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid version: %s: %w", versionStr, err)
	}

	if version == 0 {
		err = migrations.Up()
	} else {
		err = migrations.Migrate(uint(version))
	}
	if err != nil && !errors.Is(err, migrate.ErrNoChange) {
		pool.Close()
		return nil, fmt.Errorf("migrate to version %d failed: %w", version, err)
	}

	conn, err := pool.Acquire(ctx)
	if err != nil {
		pool.Close()
		return nil, err
	}

	ps, err := newPubSub(ctx, conn)
	if err != nil {
		pool.Close()
		return nil, err
	}

	queries := New(pool)
	return &Dal{pool: pool, queries: queries, ps: ps}, nil
}

type Dal struct {
	pool    *pgxpool.Pool
	queries *Queries
	ps      *pubsub
}

func (d *Dal) Shutdown() {
	_ = d.ps.Wait()
}

func (d *Dal) withTx(ctx context.Context, fn func(*Queries) error) error {
	tx, err := d.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	qtx := d.queries.WithTx(tx)
	err = fn(qtx)
	if err != nil {
		return err
	}

	err = tx.Commit(ctx)
	return err
}

func (d *Dal) CreateBooking(ctx context.Context, title string, scheduledFor time.Time, duration time.Duration) (booking BookingModel, err error) {
	endsAt := scheduledFor.Add(duration)

	err = d.withTx(ctx, func(qtx *Queries) (err error) {
		booking, err = qtx.InsertBooking(ctx, InsertBookingParams{
			Title:        title,
			ScheduledFor: scheduledFor,
			EndsAt:       endsAt,
		})
		if err != nil {
			return
		}

		return
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			if strings.Contains(pgErr.Message, "booking_overlap") {
				err = ErrBookingOverlap
			}
		}
	}

	return
}

func (d *Dal) GetBookingByID(ctx context.Context, id ID) (booking BookingModel, err error) {
	booking, err = d.queries.GetBookingById(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			err = ErrNotFound
		}
	}

	return
}

func (d *Dal) DeleteBookingByID(ctx context.Context, id ID) error {
	return d.queries.DeleteBookingById(ctx, id)
}

func (d *Dal) ListBookings(ctx context.Context, cursor *time.Time, limit int, before *time.Time, after *time.Time) (bookings []BookingModel, err error) {
	bookings, err = d.queries.ListBookings(ctx, ListBookingsParams{
		Cursor: cursor,
		Max:    int32(limit),
		Before: before,
		After:  after,
	})
	return
}

func (d *Dal) Subscribe(ctx context.Context) (<-chan struct{}, context.CancelFunc) {
	return d.ps.Subscribe(ctx)
}
