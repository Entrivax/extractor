#!/bin/sh

mkdir -p $HOME/.local/bin && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o $HOME/.local/bin/yt-dlp && sudo chmod +x $HOME/.local/bin/yt-dlp

sudo apt update && sudo apt install -y ffmpeg libavcodec-extra
