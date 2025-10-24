package db

import (
	"database/sql/driver"
	"errors"
	"fmt"

	"go.jetify.com/typeid/v2"
)

var ErrInvalidID = errors.New("invalid id")

type ID struct {
	typeid.TypeID
}

func (id ID) Value() (driver.Value, error) {
	return id.String(), nil
}

func (id *ID) Scan(value any) (err error) {
	switch value.(type) {
	case string, []byte:
		var tid typeid.TypeID
		tid, err = typeid.Parse(value.(string))
		if err != nil {
			return fmt.Errorf("invalid typeid: %w", err)
		}

		*id = ID{TypeID: tid}
		return
	default:
		return fmt.Errorf("invalid typeid, not a string")
	}
}

func parseID(prefix, str string) (ID, error) {
	tid, err := typeid.Parse(str)
	if err != nil {
		return ID{}, fmt.Errorf("%w: %w", ErrInvalidID, err)
	}

	if tid.Prefix() != prefix {
		return ID{}, fmt.Errorf("%w: prefix %s != %s", ErrInvalidID, tid.Prefix(), prefix)
	}

	return ID{TypeID: tid}, nil
}

func mustParseID(prefix, str string) ID {
	id, err := parseID(prefix, str)
	if err != nil {
		panic(fmt.Errorf("invariant violation: %s is not a valid %s id", str, prefix))
	}

	return id
}

func ParseBookingID(str string) (ID, error) {
	return parseID("boo", str)
}

func MustParseBookingID(str string) ID {
	return mustParseID("boo", str)
}
