package backup

import (
	"io"
	"io/fs"
	"sync"

	"github.com/Entrivax/extractor/extractor/internal/logging"
)

type BackupHandle struct {
	fs             WFS
	previousBackup fs.FS
	openedFilesWg  sync.WaitGroup
}

func NewBackupHandle(backupsDir WFS, previousBackupFs fs.FS) *BackupHandle {
	return &BackupHandle{fs: backupsDir, previousBackup: previousBackupFs}
}

// CopyFromPreviousBackup tries to copy the file at the given path from the previous backup.
// It returns true if the file was successfully copied, false otherwise.
func (h *BackupHandle) CopyFromPreviousBackup(path string) bool {
	if h.previousBackup == nil {
		return false
	}

	srcFile, err := h.previousBackup.Open(path)
	if err != nil {
		return false
	}
	logging.InfoLog.Printf("Copying file from previous backup: %s", path)
	defer srcFile.Close()

	err = h.PipeFile(path, srcFile)
	if err != nil {
		logging.ErrorLog.Printf("Failed to copy file from previous backup: %s, error: %v", path, err)
		return false
	}
	return true
}

func (h *BackupHandle) PipeFile(path string, stream io.Reader) error {
	h.openedFilesWg.Add(1)
	writer, err := h.fs.OpenWrite(path)
	if err != nil {
		h.openedFilesWg.Done()
		return err
	}
	defer writer.Close()
	defer h.openedFilesWg.Done()
	_, err = io.Copy(writer, stream)
	return err
}

func (h *BackupHandle) Close() error {
	h.openedFilesWg.Wait()
	return nil
}
