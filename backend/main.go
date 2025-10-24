package main

import (
	"context"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"schedulr/db"
	"schedulr/proto"

	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/logging"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	exitCode := run(ctx)
	os.Exit(exitCode)
}

func run(ctx context.Context) int {
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	slog.SetDefault(log)

	dal, err := db.Connect(ctx)
	if err != nil {
		log.Error("failed to connect to database", "err", err)
		return 1
	}
	defer dal.Shutdown()

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	rpc := &rpcServer{
		dal: dal,
		log: log.WithGroup("server"),
	}

	loggingOpts := []logging.Option{
		logging.WithLogOnEvents(logging.StartCall, logging.FinishCall),
		// Add any other option (check functions starting with logging.With).
	}

	server := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			logging.UnaryServerInterceptor(interceptorLogger(rpc.log), loggingOpts...),
		),
		grpc.ChainStreamInterceptor(
			logging.StreamServerInterceptor(interceptorLogger(rpc.log), loggingOpts...),
		),
	)
	defer server.Stop()

	reflection.Register(server)
	proto.RegisterAppointmentServiceServer(server, rpc)
	proto.RegisterEventServiceServer(server, rpc)

	errChan := make(chan error, 1)
	go func() {
		defer close(errChan)
		listener, err := net.Listen("tcp", ":"+port)
		if err != nil {
			errChan <- err
			return
		}
		defer listener.Close()

		log.Info("listening", "port", port)
		errChan <- server.Serve(listener)
	}()

	<-ctx.Done()
	server.GracefulStop()

	if err := <-errChan; err != nil {
		log.Error("serve failed", "err", err)
		return 1
	}

	return 0
}

func interceptorLogger(l *slog.Logger) logging.Logger {
	return logging.LoggerFunc(func(ctx context.Context, lvl logging.Level, msg string, fields ...any) {
		l.Log(ctx, slog.Level(lvl), msg, fields...)
	})
}
