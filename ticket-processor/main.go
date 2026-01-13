package main

import (
	"fmt"
	"strings"
	"time"
)

type Ticket struct {
	Ticket string
	User   string
	Status string
	Date   time.Time
}

func GetTasks(text string, user *string, status *string) []Ticket {
	res := []Ticket{}
	newtext := strings.Split(text, "\n")
	for _, s := range newtext {
		s = strings.TrimSpace(s)
		if s == "" || s == "U+000A" || s == "U+009" {
			continue
		}
		r := strings.Split(s, "_")
		r[0] = strings.TrimSpace(r[0])
		temp := strings.Split(r[0], "-")
		temp[0] = strings.TrimSpace(temp[0])
		if temp[0] != "TICKET" || len(r) != 4 || len(temp) != 2 {
			continue
		}
		r[1] = strings.TrimSpace(r[1])
		r[2] = strings.TrimSpace(r[2])
		if !(r[2] == "Готово" || r[2] == "В работе" || r[2] == "Не будет сделано") {
			continue
		}
		r[3] = strings.TrimSpace(r[3])
		timeStamp, err := time.Parse("2006-01-02", r[3])
		if err != nil {
			continue
		}
		ticket := Ticket{
			Ticket: r[0],
			User:   r[1],
			Status: r[2],
			Date:   timeStamp,
		}
		res = append(res, ticket)
	}

	ans := []Ticket{}
	if user != nil && status != nil {
		for _, i := range res {
			if i.User == *user && i.Status == *status {
				ans = append(ans, i)
			}
		}
	} else if user != nil {
		for _, i := range res {
			if i.User == *user {
				ans = append(ans, i)
			}
		}

	} else if status != nil {
		for _, i := range res {
			if i.Status == *status {
				ans = append(ans, i)
			}
		}

	} else {
		return res
	}
	return ans
}

func main() {
	chatHistory := `
		TICKET-12345_Паша Попов_Готово_2024-01-01
        TICKET-12346_Иван Иванов_В работе_2024-01-02
        TICKET-12347_Анна Смирнова_Не будет сделано_2024-01-03
        TICKET-12348_Паша Попов_В работе_2024-01-04
		TICKET-12355_Иван Иванов_В работе_2024-01-10!!!
		`

	// Тест 1: поиск всех задач Паши Попова
	user := "Паша Попов"
	tasks := GetTasks(chatHistory, &user, nil)
	if len(tasks) != 2 {
		fmt.Printf("Ожидалось 2 задачи для Паши Попова, найдено %d: text %v, user %v, status %v\n", len(tasks), chatHistory, user, nil)
	}
	for _, task := range tasks {
		if task.User != "Паша Попов" {
			fmt.Printf("Найденная задача не принадлежит Паше Попову: %v\n", task)
		}
	}

	stat := "В работе"
	workTasks := GetTasks(chatHistory, nil, &stat)
	if len(workTasks) != 2 {
		fmt.Printf("Ожидалось 2 задачи со статусом 'В работе', найдено %d: text %v, user %v, status %v", len(workTasks), chatHistory, nil, stat)
	}
	for _, task := range workTasks {
		if task.Status != stat {
			fmt.Printf("Найденная задача не в работе: %v\n", task)

		}
	}
}
