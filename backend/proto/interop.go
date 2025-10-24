package proto

import (
	"schedulr/db"

	durationpb "google.golang.org/protobuf/types/known/durationpb"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
)

func NewAppointmentFromBookingModel(model db.BookingModel) *Appointment {
	var app Appointment
	app.SetBookingId(model.ID.String())
	app.SetTitle(model.Title)
	app.SetDuration(durationpb.New(model.EndsAt.Sub(model.ScheduledFor)))
	app.SetScheduledFor(timestamppb.New(model.ScheduledFor))
	app.SetScheduledAt(timestamppb.New(model.CreatedAt))
	return &app
}
