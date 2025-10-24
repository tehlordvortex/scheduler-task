package db

import (
	"context"
	"slices"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
)

type pubsub struct {
	conn    *pgxpool.Conn
	errChan chan error

	m    sync.Mutex
	subs []*sub
}

type sub struct {
	notify chan struct{}
}

func newPubSub(ctx context.Context, conn *pgxpool.Conn) (*pubsub, error) {
	_, err := conn.Exec(ctx, "listen booking_changed;")
	if err != nil {
		return nil, err
	}

	ps := &pubsub{conn: conn, errChan: make(chan error, 1)}
	go ps.loop(ctx)

	return ps, nil
}

func (ps *pubsub) Wait() error {
	err, ok := <-ps.errChan
	if !ok {
		return nil
	}

	return err
}

func (ps *pubsub) Subscribe(ctx context.Context) (<-chan struct{}, context.CancelFunc) {
	subscription := &sub{notify: make(chan struct{}, 1)}
	cancel := func() {
		ps.m.Lock()
		defer ps.m.Unlock()

		isSub := func(e *sub) bool { return subscription == e }
		if slices.ContainsFunc(ps.subs, isSub) {
			ps.subs = slices.DeleteFunc(ps.subs, isSub)
			close(subscription.notify)
		}
	}

	ps.m.Lock()
	defer ps.m.Unlock()

	ps.subs = append(ps.subs, subscription)
	go func() {
		<-ctx.Done()
		cancel()
	}()

	return subscription.notify, cancel
}

func (ps *pubsub) loop(ctx context.Context) {
	defer ps.cancelSubs()

	for {
		_, err := ps.conn.Conn().WaitForNotification(ctx)
		if err != nil {
			ps.errChan <- err
			return
		}

		if err := ps.tryNotifySubs(ctx); err != nil {
			ps.errChan <- err
			return
		}
	}
}

func (ps *pubsub) tryNotifySubs(ctx context.Context) error {
	ps.m.Lock()
	defer ps.m.Unlock()

	for _, sub := range ps.subs {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case sub.notify <- struct{}{}:
			continue
		default:
			continue
		}
	}

	return nil
}

func (ps *pubsub) cancelSubs() {
	ps.m.Lock()
	defer ps.m.Unlock()

	for _, sub := range ps.subs {
		close(sub.notify)
	}

	close(ps.errChan)
}
