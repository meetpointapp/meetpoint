#!/bin/bash
# slow_audio.sh <dir> [tempo]  : <dir>/audio/line_NN.wav -> <dir>/audio_s/line_NN.wav (atempo, trims silence edges)
d=$1; t=${2:-0.9}; mkdir -p $d/audio_s
for f in $d/audio/line_*.wav; do
  ffmpeg -v error -y -i $f -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,atempo=$t" -ar 44100 $d/audio_s/$(basename $f)
done
echo ok
