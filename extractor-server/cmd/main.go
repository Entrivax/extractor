package main

import (
	"flag"
	"os"
	"reflect"
	"strings"

	"github.com/Entrivax/extractor/extractor/internal/logging"
	"github.com/Entrivax/extractor/extractor/internal/server"
)

type Configuration struct {
	Addr                 string `env:"EXTRACTOR_ADDR" flag:"addr,Server listen address" default:":7766"`
	UseHTTPS             bool   `env:"EXTRACTOR_HTTPS" flag:"https,Use HTTPS for serving" default:"true"`
	CertFile             string `env:"EXTRACTOR_CERT_FILE" flag:"cert-file,Path to TLS certificate file" default:"server.crt"`
	KeyFile              string `env:"EXTRACTOR_KEY_FILE" flag:"key-file,Path to TLS key file" default:"server.key"`
	SavePath             string `env:"EXTRACTOR_SAVE_PATH" flag:"save-path,Path to save backups" default:"backup"`
	BackupFolderTemplate string `env:"EXTRACTOR_BACKUP_FOLDER_TEMPLATE" flag:"backup-folder-template,Template for backup folder names" default:"{{.Extractor}}_{{.CreatorVanity}}_{{.Timestamp}}"`
}

func setConfig(configuration *Configuration) {
	v := reflect.ValueOf(configuration).Elem()
	for i := 0; i < v.NumField(); i++ {
		field := v.Type().Field(i)
		envTag := field.Tag.Get("env")
		flagTag := field.Tag.Get("flag")
		defaultTag := field.Tag.Get("default")
		flagName := flagTag
		flagDesc := ""
		if flagTag != "" {
			parts := strings.SplitN(flagTag, ",", 2)
			if len(parts) == 2 {
				flagName = parts[0]
				flagDesc = parts[1]
			}
		}
		switch v.Field(i).Kind() {
		case reflect.String:
			envValue := os.Getenv(envTag)
			if envValue == "" {
				envValue = defaultTag
			}
			flag.StringVar(v.Field(i).Addr().Interface().(*string), flagName, envValue, flagDesc)
		case reflect.Bool:
			defaultBool := false
			envValue := os.Getenv(envTag)
			if envValue == "" {
				envValue = defaultTag
			}
			if envValue == "true" {
				defaultBool = true
			}
			flag.BoolVar(v.Field(i).Addr().Interface().(*bool), flagName, defaultBool, flagDesc)
		}
	}
	flag.Parse()
}

func main() {
	logging.Init(os.Stdout, os.Stderr)
	configuration := &Configuration{}
	setConfig(configuration)
	srv := server.NewServer(configuration.SavePath, configuration.BackupFolderTemplate)
	srv.StartWorkers(6, 1)
	if configuration.UseHTTPS {
		certFile := configuration.CertFile
		keyFile := configuration.KeyFile
		srv.WithHTTPS(certFile, keyFile)
	}
	if err := srv.Listen(configuration.Addr); err != nil {
		panic(err)
	}
}
