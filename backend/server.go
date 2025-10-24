package main

import (
	"context"
	"encoding/base64"
	"errors"
	"log/slog"
	"schedulr/db"
	"schedulr/proto"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"google.golang.org/protobuf/types/known/emptypb"
)

type rpcServer struct {
	proto.UnimplementedAppointmentServiceServer
	proto.UnimplementedEventServiceServer

	log *slog.Logger
	dal *db.Dal
}

var errInternal = status.Errorf(codes.Internal, "oops")

func (r *rpcServer) Schedule(ctx context.Context, req *proto.ScheduleAppointmentRequest) (*proto.Appointment, error) {
	if err := proto.Validate(req); err != nil {
		return nil, err
	}

	title := req.GetTitle()
	scheduledFor := req.GetScheduledFor().AsTime()
	duration := req.GetDuration().AsDuration()

	model, err := r.dal.CreateBooking(ctx, title, scheduledFor, duration)
	if err != nil {
		switch true {
		case errors.Is(err, db.ErrBookingOverlap):
			return nil, status.Errorf(codes.AlreadyExists, "an appointment has already been booked around %s", scheduledFor.Format(time.RFC1123Z))
		default:
			r.log.Error("failed to create appointment", "err", err)
			return nil, errInternal
		}
	}

	return proto.NewAppointmentFromBookingModel(model), nil
}

func (r *rpcServer) List(ctx context.Context, req *proto.ListAppointmentsRequest) (*proto.Appointments, error) {
	validReq, err := req.Validate()
	if err != nil {
		return nil, err
	}

	limit := int(req.GetLimit())
	models, err := r.dal.ListBookings(ctx, validReq.Cursor, limit+1, validReq.Before, validReq.After)
	if err != nil {
		r.log.Error("failed to list bookings", "err", err)
		return nil, errInternal

	}

	var nextCursor *string
	var items []*proto.Appointment
	for idx, model := range models {
		if idx == limit {
			prevModel := models[idx-1]
			cursorStr := prevModel.ScheduledFor.Format(time.RFC3339)
			cursorStr = base64.StdEncoding.EncodeToString([]byte(cursorStr))
			nextCursor = &cursorStr
			break
		}

		items = append(items, proto.NewAppointmentFromBookingModel(model))
	}

	var apps proto.Appointments
	apps.SetAppointments(items)
	if nextCursor != nil {
		apps.SetNextCursor(*nextCursor)
	}

	return &apps, nil
}

func (r *rpcServer) Get(ctx context.Context, req *proto.GetAppointmentRequest) (*proto.Appointment, error) {
	validReq, err := req.Validate()
	if err != nil {
		return nil, err
	}

	model, err := r.dal.GetBookingByID(ctx, validReq.ID)
	if err != nil {
		switch true {
		case errors.Is(err, db.ErrNotFound):
			return nil, status.Errorf(codes.NotFound, "booking id not found")
		default:
			r.log.Error("failed to get booking", "err", err)
			return nil, errInternal
		}
	}

	return proto.NewAppointmentFromBookingModel(model), nil
}

func (r *rpcServer) Delete(ctx context.Context, req *proto.DeleteAppointmentRequest) (*emptypb.Empty, error) {
	validReq, err := req.Validate()
	if err != nil {
		return nil, err
	}

	if err := r.dal.DeleteBookingByID(ctx, validReq.ID); err != nil {
		r.log.Error("failed to delete booking", "err", err)
		return nil, errInternal
	}

	return &emptypb.Empty{}, nil
}

func (r *rpcServer) Subscribe(req *proto.SubscribeRequest, sss grpc.ServerStreamingServer[proto.Event]) error {
	errChan := make(chan error, 1)
	notify, _ := r.dal.Subscribe(sss.Context())

	go func() {
		for range notify {
			var event proto.Event
			event.SetBookingChanged(&proto.BookingChangedEvent{})
			if err := sss.Send(&event); err != nil {
				errChan <- err
				return
			}
		}

		errChan <- nil
	}()

	return <-errChan
}
