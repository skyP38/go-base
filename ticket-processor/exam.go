package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"
)

type Ticket struct {
	Ticket string
	User   string
	Status string
	Date   time.Time
}

var (
	ErrInvalidFormat   = errors.New("неверный формат строки")
	ErrInvalidStatus   = errors.New("неверный статус")
	ErrInvalidDate     = errors.New("неверный формат даты")
	ErrInvalidTicketID = errors.New("неверный формат ID тикета")
)

func GetTasks(
	ctx context.Context,
	r io.Reader,
	w io.Writer,
	user *string,
	status *string,
	timeout time.Duration,
) error {
	ctxWithTimeout, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	data, err := readDataWithContext(ctxWithTimeout, r)
	if err != nil {
		return err
	}

	tickets, err := parseTickets(ctxWithTimeout, data)
	if err != nil {
		return err
	}

	filteredTickets := filterTickets(ctxWithTimeout, tickets, user, status)

	return writeResult(ctxWithTimeout, w, filteredTickets)
}

func readDataWithContext(ctx context.Context, r io.Reader) (string, error) {
	var builder strings.Builder
	buf := make([]byte, 1024)

	for {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		default:
			n, err := r.Read(buf)
			if err != nil && err != io.EOF {
				return "", err
			}
			if n > 0 {
				builder.Write(buf[:n])
			}
			if err == io.EOF {
				return builder.String(), nil
			}
		}
	}
}

func parseTickets(ctx context.Context, text string) ([]Ticket, error) {
	res := []Ticket{}
	lines := strings.Split(text, "\n")

	for _, s := range lines {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
			s = strings.TrimSpace(s)
			if s == "" || s == "U+000A" || s == "U+009" {
				continue
			}

			ticket, err := parseTicketLine(s)
			if err != nil {
				continue
			}

			res = append(res, ticket)
		}
	}
	return res, nil
}

func parseTicketLine(s string) (Ticket, error) {
	parts := strings.Split(s, "_")
	if len(parts) != 4 {
		return Ticket{}, ErrInvalidFormat
	}

	ticketID := strings.TrimSpace(parts[0])
	ticketParts := strings.Split(ticketID, "-")
	if len(ticketParts) != 2 {
		return Ticket{}, ErrInvalidTicketID
	}

	ticketPrefix := strings.TrimSpace(ticketParts[0])
	if ticketPrefix != "TICKET" {
		return Ticket{}, ErrInvalidTicketID
	}

	status := strings.TrimSpace(parts[2])
	if !isValidStatus(status) {
		return Ticket{}, ErrInvalidStatus
	}

	data := strings.TrimSpace(parts[3])
	timeStamp, err := time.Parse("2006-01-02", data)
	if err != nil {
		return Ticket{}, ErrInvalidDate
	}
	ticket := Ticket{
		Ticket: ticketID,
		User:   strings.TrimSpace(parts[1]),
		Status: status,
		Date:   timeStamp,
	}
	return ticket, nil
}

func isValidStatus(s string) bool {
	return s == "Готово" || s == "В работе" || s == "Не будет сделано"
}

func filterTickets(ctx context.Context, tickets []Ticket, user *string, status *string) []Ticket {
	select {
	case <-ctx.Done():
		return []Ticket{}
	default:
		if user != nil && status != nil {
			return tickets
		}

		filtered := make([]Ticket, 0, len(tickets))

		for _, ticket := range tickets {
			select {
			case <-ctx.Done():
				return filtered
			default:
				userMatch := user == nil || ticket.User == *user
				statusMatch := status == nil || ticket.Status == *status
				if userMatch && statusMatch {
					filtered = append(filtered, ticket)
				}
			}
		}

		return filtered
	}
}

func writeResult(ctx context.Context, w io.Writer, tickets []Ticket) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		encoder := json.NewEncoder(w)
		encoder.SetIndent("", " ")
		return encoder.Encode(tickets)
	}
}
