package server

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io/fs"
	"net/http"
	"os"
	"text/template"
	"time"

	"github.com/Entrivax/extractor/extractor/internal/backup"
	"github.com/Entrivax/extractor/extractor/internal/logging"
)

type Server struct {
	handles  map[string]*backup.BackupHandle
	saveFs   backup.WFS
	httpJobs chan *backup.HttpJob
	ytDlJobs chan *backup.YtDlJob

	folderTemplate *template.Template
	useHTTPS       bool
	certFile       string
	keyFile        string
}

func NewServer(savePath string, folderTemplate string) *Server {
	saveFs := backup.NewOsDirFS(savePath)
	templ := template.Must(template.New("folderTemplate").Parse(folderTemplate))
	return &Server{
		handles:        make(map[string]*backup.BackupHandle),
		saveFs:         saveFs,
		folderTemplate: templ,
		httpJobs:       make(chan *backup.HttpJob, 10000),
		ytDlJobs:       make(chan *backup.YtDlJob, 1000),
	}
}

func (s *Server) WithHTTPS(certFile, keyFile string) *Server {
	s.useHTTPS = true
	s.certFile = certFile
	s.keyFile = keyFile
	return s
}

func (s *Server) StartWorkers(numHttpWorkers int, numYtDlWorkers int) {
	for range numHttpWorkers {
		go backup.HttpWorker(s.httpJobs)
	}
	for range numYtDlWorkers {
		go backup.YtDlWorker(s.ytDlJobs)
	}
}

func (s *Server) Listen(addr string) error {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /", s.handleHome)
	mux.HandleFunc("POST /create-backup", s.handleCreateBackup)
	mux.HandleFunc("GET /backup/{id}/jobs", s.handleJobs)
	mux.HandleFunc("POST /backup/{id}/file", s.handleUploadFile)
	mux.HandleFunc("POST /backup/{id}/copy-file", s.handleCopyFile)
	mux.HandleFunc("POST /backup/{id}/queue-urls", s.handleQueueUrls)
	mux.HandleFunc("POST /backup/{id}/queue-yt-dl", s.handleQueueYtDl)
	mux.HandleFunc("POST /backup/{id}/close", s.handleCloseBackup)

	logging.InfoLog.Printf("Starting server on %s", addr)
	if !s.useHTTPS {
		return http.ListenAndServe(addr, mux)
	}
	logging.InfoLog.Printf("Using HTTPS with cert: %s and key: %s", s.certFile, s.keyFile)
	return http.ListenAndServeTLS(addr, s.certFile, s.keyFile, mux)
}

func (s *Server) handleHome(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("Extractor Backup Server is running"))
}

func (s *Server) handleCreateBackup(w http.ResponseWriter, r *http.Request) {
	key := generateId()
	date := time.Now()
	timestamp := date.Format("2006-01-02_15-04-05")
	buf := new(bytes.Buffer)
	s.folderTemplate.Execute(buf, map[string]any{
		"Extractor":     r.PostFormValue("extractor"),
		"CreatorId":     r.PostFormValue("creator_id"),
		"CreatorVanity": r.PostFormValue("creator_vanity"),
		"Timestamp":     timestamp,
		"Date":          date,
		"RandomId":      key,
	})
	backupLocation := buf.String()
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

func (s *Server) handleJobs(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	handle, exists := s.handles[id]
	if !exists {
		fuckOff(w, "Backup handle not found", nil, http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(map[string]any{
		"http_jobs_pending":    len(handle.HttpJobs),
		"yt_dl_jobs_pending":   len(handle.YtDlJobs),
		"http_jobs_completed":  countCompletedJobs(handle.HttpJobs),
		"yt_dl_jobs_completed": countCompletedJobs(handle.YtDlJobs),
	})
}

func countCompletedJobs[T interface{ IsDone() bool }](jobs []T) int {
	count := 0
	for _, job := range jobs {
		if job.IsDone() {
			count++
		}
	}
	return count
}

type AppendFromUrlsRequest struct {
	Files []struct {
		Path string `json:"path"`
		Url  string `json:"url"`
	} `json:"files"`
}

func (s *Server) handleQueueUrls(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	handle, exists := s.handles[id]
	if !exists {
		fuckOff(w, "Backup handle not found", nil, http.StatusNotFound)
		return
	}
	userAgent := r.Header.Get("User-Agent")
	referer := r.Header.Get("Referer")
	var req AppendFromUrlsRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		fuckOff(w, "Failed to parse request body", err, http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	jobs := make([]*backup.HttpJob, len(req.Files))
	for i, file := range req.Files {
		jobs[i] = &backup.HttpJob{
			FilePath:     file.Path,
			SourceUrl:    file.Url,
			UserAgent:    userAgent,
			Referer:      referer,
			BackupHandle: handle,
		}
	}
	handle.HttpJobs = append(handle.HttpJobs, jobs...)
	go func() {
		for _, job := range jobs {
			s.httpJobs <- job
		}
	}()

	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) handleQueueYtDl(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	handle, exists := s.handles[id]
	if !exists {
		fuckOff(w, "Backup handle not found", nil, http.StatusNotFound)
		return
	}
	userAgent := r.Header.Get("User-Agent")
	referer := r.Header.Get("Referer")
	var req AppendFromUrlsRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		fuckOff(w, "Failed to parse request body", err, http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	jobs := make([]*backup.YtDlJob, len(req.Files))
	for i, file := range req.Files {
		jobs[i] = &backup.YtDlJob{
			FilePath:     file.Path,
			SourceUrl:    file.Url,
			UserAgent:    userAgent,
			Referer:      referer,
			BackupHandle: handle,
		}
	}
	handle.YtDlJobs = append(handle.YtDlJobs, jobs...)
	go func() {
		for _, job := range jobs {
			s.ytDlJobs <- job
		}
	}()

	w.WriteHeader(http.StatusAccepted)
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
