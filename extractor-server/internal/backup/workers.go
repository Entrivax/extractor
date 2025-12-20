package backup

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"time"

	"github.com/Entrivax/extractor/extractor/internal/logging"
)

type HttpJob struct {
	FilePath     string
	SourceUrl    string
	UserAgent    string
	Referer      string
	BackupHandle *BackupHandle
	Err          error
	done         bool
}

func (j HttpJob) IsDone() bool {
	return j.done
}

type YtDlJob struct {
	FilePath     string
	SourceUrl    string
	UserAgent    string
	Referer      string
	BackupHandle *BackupHandle
	Err          error
	done         bool
}

func (j YtDlJob) IsDone() bool {
	return j.done
}

func appendFileFromUrl(job *HttpJob) error {
	handle := job.BackupHandle
	filePath := job.FilePath

	// Try to copy from previous backup first, if not found, proceed to download
	if handle.CopyFromPreviousBackup(filePath) {
		return nil
	}

	for attempt := range 5 {
		var resp *http.Response
		req, err := http.NewRequest("GET", job.SourceUrl, nil)
		retryLog := ""
		if attempt > 0 {
			retryLog = fmt.Sprintf(" (attempt %d)", attempt+1)
		}
		if err != nil {
			logging.ErrorLog.Printf("Failed to create request for URL %s: %v", job.SourceUrl, err)
			return err
		}
		req.Header.Set("User-Agent", job.UserAgent)
		req.Header.Set("Referer", job.Referer)

		// Be gentle with target servers
		time.Sleep(time.Millisecond * 250)

		logging.InfoLog.Printf("Downloading file from URL%s: %s", retryLog, job.SourceUrl)
		resp, err = http.DefaultClient.Do(req)
		if err != nil {
			logging.ErrorLog.Printf("Failed to fetch URL %s: %v", job.SourceUrl, err)
			time.Sleep(time.Second * 10 * time.Duration(attempt+1))
			continue
		}

		defer resp.Body.Close()

		err = handle.PipeFile(filePath, resp.Body)
		if err != nil {
			logging.ErrorLog.Printf("Failed to append file %s: %v", filePath, err)
			continue
		}
		break
	}

	return nil
}

func HttpWorker(jobs chan *HttpJob) {
	for job := range jobs {
		job.Err = appendFileFromUrl(job)
		job.done = true
	}
}

func downloadWithYtDl(job *YtDlJob) error {
	handle := job.BackupHandle
	filePath := job.FilePath

	// Try to copy from previous backup first, if not found, proceed to download
	if handle.CopyFromPreviousBackup(filePath) {
		return nil
	}

	tmpDir, err := os.MkdirTemp("", "yt-dlp-*")
	if err != nil {
		logging.ErrorLog.Printf("Failed to create temp dir: %v", err)
		return err
	}

	defer os.RemoveAll(tmpDir)

	url := job.SourceUrl
	logging.InfoLog.Printf("Downloading file with yt-dlp from URL: %s", url)
	outputTemplate := tmpDir + "/output.mp4"
	cmd := exec.Command(
		"yt-dlp",
		"--user-agent", job.UserAgent,
		"--referer", job.Referer,
		"-o", outputTemplate,
		url,
	)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Run()
	if err != nil {
		logging.ErrorLog.Printf("yt-dlp failed: %v", err)
		return err
	}

	files, err := os.ReadDir(tmpDir)
	if err != nil || len(files) == 0 {
		logging.ErrorLog.Printf("No files downloaded: %v", err)
		return err
	}

	downloadedFile, err := os.Open(outputTemplate)
	if err != nil {
		logging.ErrorLog.Printf("Failed to open downloaded file: %v", err)
		return err
	}
	defer downloadedFile.Close()

	err = handle.PipeFile(job.FilePath, downloadedFile)
	if err != nil {
		logging.ErrorLog.Printf("Failed to save downloaded file: %v", err)
		return err
	}
	return nil
}

func YtDlWorker(jobs chan *YtDlJob) {
	for job := range jobs {
		job.Err = downloadWithYtDl(job)
		job.done = true
	}
}
