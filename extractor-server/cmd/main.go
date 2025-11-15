package main

import (
	"os"

	"github.com/Entrivax/extractor/extractor/internal/logging"
	"github.com/Entrivax/extractor/extractor/internal/server"
)

func main() {
	logging.Init(os.Stdout, os.Stderr)
	srv := server.NewServer("backup")
	if err := srv.Listen(); err != nil {
		panic(err)
	}
}
