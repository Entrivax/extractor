package logging

import (
	"io"
	"log"
)

var (
	InfoLog  *log.Logger
	ErrorLog *log.Logger
)

func Init(infoWriter, errorWriter io.Writer) {
	InfoLog = log.New(infoWriter, "INFO: ", log.Ldate|log.Ltime|log.Lshortfile)
	ErrorLog = log.New(errorWriter, "ERROR: ", log.Ldate|log.Ltime|log.Lshortfile)
}
