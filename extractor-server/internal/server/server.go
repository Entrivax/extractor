package server

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path"
	"time"

	"github.com/Entrivax/extractor/extractor/internal/backup"
	"github.com/Entrivax/extractor/extractor/internal/logging"
)

type Server struct {
	handles map[string]*backup.BackupHandle
	saveFs  backup.WFS
}

func NewServer(savePath string) *Server {
	saveFs := backup.NewOsDirFS(savePath)
	return &Server{
		handles: make(map[string]*backup.BackupHandle),
		saveFs:  saveFs,
	}
}

var addr = flag.String("addr", ":7766", "http service address")

func (s *Server) Listen() error {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /create-backup", s.handleCreateBackup)
	mux.HandleFunc("POST /backup/{id}/file", s.handleUploadFile)
	mux.HandleFunc("POST /backup/{id}/copy-file", s.handleCopyFile)
	mux.HandleFunc("POST /backup/{id}/append-from-url", s.handleAppendFileFromUrl)
	mux.HandleFunc("POST /backup/{id}/download-with-yt-dl", s.handleDownloadWithYtDl)
	mux.HandleFunc("POST /backup/{id}/close", s.handleCloseBackup)
	return http.ListenAndServe(*addr, mux)
}

func (s *Server) handleCreateBackup(w http.ResponseWriter, r *http.Request) {
	key := generateId()
	date := time.Now().Format("2006-01-02_15-04-05")
	backupLocation := fmt.Sprintf("backup_%s_%s", date, key)
	logging.InfoLog.Printf("Creating new backup at %s", backupLocation)

	var previousBackupFs fs.FS = nil
	if previousBackupLocation := r.PostFormValue("previous_backup_location"); previousBackupLocation != "" {
		if stat, err := os.Stat(previousBackupLocation); os.IsNotExist(err) || !stat.IsDir() {
			fuckOff(w, "Previous backup location does not exist or is not a directory", nil, http.StatusBadRequest)
			return
		}
		previousBackupFs = os.DirFS(previousBackupLocation)
		logging.InfoLog.Printf("Using previous backup location: %s", previousBackupLocation)
	}

	s.handles[key] = backup.NewBackupHandle(s.saveFs.SubFs(backupLocation), previousBackupFs)
	json.NewEncoder(w).Encode(map[string]string{"key": key})
}

func (s *Server) handleCopyFile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	handle, exists := s.handles[id]
	if !exists {
		fuckOff(w, "Backup handle not found", nil, http.StatusNotFound)
		return
	}
	filePath := r.URL.Query().Get("path")

	var status = "nok"
	if handle.CopyFromPreviousBackup(filePath) {
		status = "ok"
	}
	json.NewEncoder(w).Encode(map[string]string{"success": status})
}

func (s *Server) handleUploadFile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	handle, exists := s.handles[id]
	if !exists {
		fuckOff(w, "Backup handle not found", nil, http.StatusNotFound)
		return
	}
	filePath := r.URL.Query().Get("path")
	err := handle.PipeFile(filePath, r.Body)
	if err != nil {
		fuckOff(w, "Failed to upload file", err, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleAppendFileFromUrl(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	handle, exists := s.handles[id]
	if !exists {
		fuckOff(w, "Backup handle not found", nil, http.StatusNotFound)
		return
	}
	filePath := r.FormValue("path")

	// Try to copy from previous backup first, if not found, proceed to download
	if handle.CopyFromPreviousBackup(filePath) {
		return
	}

	userAgent := r.Header.Get("User-Agent")
	referer := r.Header.Get("Referer")

	req, err := http.NewRequest("GET", r.FormValue("url"), nil)
	if err != nil {
		fuckOff(w, "Failed to create request", err, http.StatusInternalServerError)
		return
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Referer", referer)

	// Be gentle with target servers
	time.Sleep(time.Millisecond * 250)

	logging.InfoLog.Printf("Downloading file from URL: %s", r.FormValue("url"))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fuckOff(w, fmt.Sprintf("Failed to fetch URL: %s", r.FormValue("url")), err, http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	err = handle.PipeFile(filePath, resp.Body)
	if err != nil {
		fuckOff(w, "Failed to append file", err, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleDownloadWithYtDl(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	handle, exists := s.handles[id]
	if !exists {
		fuckOff(w, "Backup handle not found", nil, http.StatusNotFound)
		return
	}

	tmpDir, err := os.MkdirTemp("", "yt-dlp-*")
	if err != nil {
		fuckOff(w, "Failed to create temp dir", err, http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(tmpDir)

	url := r.FormValue("url")
	logging.InfoLog.Printf("Downloading file with yt-dlp from URL: %s", url)
	outputTemplate := tmpDir + "/output.%(ext)s"
	cmd := exec.Command(
		"yt-dlp",
		"--user-agent", r.Header.Get("User-Agent"),
		"--referer", r.Header.Get("Referer"),
		"-o", outputTemplate,
		url,
	)
	err = cmd.Run()
	if err != nil {
		fuckOff(w, "yt-dlp failed", err, http.StatusInternalServerError)
		return
	}

	files, err := os.ReadDir(tmpDir)
	if err != nil || len(files) == 0 {
		fuckOff(w, "No files downloaded", err, http.StatusInternalServerError)
		return
	}

	downloadedFilePath := path.Join(tmpDir, files[0].Name())
	downloadedFile, err := os.Open(downloadedFilePath)
	if err != nil {
		fuckOff(w, "Failed to open downloaded file", err, http.StatusInternalServerError)
		return
	}
	defer downloadedFile.Close()

	filePath := path.Join("media", r.PostFormValue("media_id")+path.Ext(files[0].Name()))
	err = handle.PipeFile(filePath, downloadedFile)
	if err != nil {
		fuckOff(w, "Failed to save downloaded file", err, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"file_path": filePath})
}

func (s *Server) handleCloseBackup(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	handle, exists := s.handles[id]
	if !exists {
		fuckOff(w, "Backup handle not found", nil, http.StatusNotFound)
		return
	}

	err := handle.Close()
	if err != nil {
		fuckOff(w, "Failed to close backup", err, http.StatusInternalServerError)
		return
	}
	delete(s.handles, id)
	logging.InfoLog.Printf("Closed backup %s", id)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func generateId() string {
	randBytes := make([]byte, 20)
	rand.Read(randBytes)
	return hex.EncodeToString(randBytes)
}

func fuckOff(w http.ResponseWriter, message string, err error, errorCode int) {
	logging.ErrorLog.Printf("%s: %v", message, err)
	w.WriteHeader(errorCode)
	json.NewEncoder(w).Encode(map[string]string{"error": "failed to process request"})
}
