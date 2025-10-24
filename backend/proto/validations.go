package proto

import (
	"encoding/base64"
	"schedulr/db"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type validatesAndReturns[T any] interface {
	Validate() (T, error)
}

type validates interface {
	Validate() error
}

func Validate(msg any) error {
	switch msg := msg.(type) {
	case validatesAndReturns[any]:
		_, err := msg.Validate()
		return err
	case validates:
		return msg.Validate()
	default:
		return nil
	}
}

func (r *ScheduleAppointmentRequest) Validate() error {
	if r.GetTitle() == "" {
		return status.Errorf(codes.InvalidArgument, "validation: title cannot be blank")
	}

	if r.GetScheduledFor() == nil || r.GetScheduledFor().AsTime().Before(time.Now()) {
		return status.Errorf(codes.InvalidArgument, "validation: cannot schedule in the past")
	}

	return nil
}

type ValidListAppointmentsRequest struct {
	*ListAppointmentsRequest
	Cursor *time.Time
	Before *time.Time
	After  *time.Time
}

func (r *ListAppointmentsRequest) Validate() (*ValidListAppointmentsRequest, error) {
	var cursor *time.Time
	if r.HasCursor() {
		cursorStr := r.GetCursor()

		decoded, err := base64.StdEncoding.DecodeString(cursorStr)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "validation: invalid cursor")
		}

		cursorTime, err := time.Parse(time.RFC3339, string(decoded))
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "validation: invalid cursor")
		}

		cursor = &cursorTime
	}

	var before *time.Time
	if r.HasBefore() {
		time := r.GetBefore().AsTime()
		before = &time
	}

	var after *time.Time
	if r.HasAfter() {
		time := r.GetAfter().AsTime()
		after = &time
	}

	req := ValidListAppointmentsRequest{
		ListAppointmentsRequest: r,
		Cursor:                  cursor, Before: before, After: after,
	}
	return &req, nil
}

type ValidGetAppointmentRequest struct {
	*GetAppointmentRequest
	ID db.ID
}

func (r *GetAppointmentRequest) Validate() (*ValidGetAppointmentRequest, error) {
	idStr := r.GetBookingId()
	id, err := db.ParseBookingID(idStr)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "validation: bookingId is invalid")
	}

	req := ValidGetAppointmentRequest{GetAppointmentRequest: r, ID: id}
	return &req, nil
}

type ValidDeleteAppointmentRequest struct {
	*DeleteAppointmentRequest
	ID db.ID
}

func (r *DeleteAppointmentRequest) Validate() (*ValidDeleteAppointmentRequest, error) {
	idStr := r.GetBookingId()
	id, err := db.ParseBookingID(idStr)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "validation: bookingId is invalid")
	}

	req := ValidDeleteAppointmentRequest{DeleteAppointmentRequest: r, ID: id}
	return &req, nil
}
