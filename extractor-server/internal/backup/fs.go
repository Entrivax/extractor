package backup

import (
	"errors"
	"io"
	"io/fs"
	"os"
	"path"
)

type WFS interface {
	WriteFile(name string, data []byte, perm os.FileMode) error
	MkDirAll(path string, perm os.FileMode) error
	SubFs(subDir string) WFS
	OpenWrite(name string) (io.WriteCloser, error)
	Exists(name string) bool
}

type OsDirFS struct {
	basePath string
}

func NewOsDirFS(basePath string) *OsDirFS {
	return &OsDirFS{basePath: basePath}
}

func (o *OsDirFS) SubFs(subDir string) WFS {
	subDir = path.Join(o.basePath, path.Clean(subDir))
	return &OsDirFS{basePath: subDir}
}

func (o *OsDirFS) WriteFile(name string, data []byte, perm os.FileMode) error {
	if err := o.MkDirAll(path.Dir(name), os.ModePerm); err != nil {
		return err
	}
	fullPath := path.Join(o.basePath, path.Clean(name))
	return os.WriteFile(fullPath, data, perm)
}

func (o *OsDirFS) MkDirAll(dirPath string, perm os.FileMode) error {
	fullPath := path.Join(o.basePath, path.Clean(dirPath))
	return os.MkdirAll(fullPath, perm)
}

func (o *OsDirFS) OpenWrite(name string) (io.WriteCloser, error) {
	if err := o.MkDirAll(path.Dir(name), os.ModePerm); err != nil {
		return nil, err
	}
	fullPath := path.Join(o.basePath, path.Clean(name))
	f, err := os.OpenFile(fullPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, fs.ModePerm)
	if err != nil {
		return nil, err
	}
	return f, nil
}

func (o *OsDirFS) Exists(name string) bool {
	fullPath := path.Join(o.basePath, path.Clean(name))
	_, err := os.Stat(fullPath)
	return !errors.Is(err, fs.ErrNotExist)
}
