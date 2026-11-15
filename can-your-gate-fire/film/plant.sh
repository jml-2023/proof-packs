#!/bin/sh
# Make a copy of a film with one known defect in it, so you can see whether your checks catch it.
# Your film is never changed; each defect is written to a new file. Needs ffmpeg.
#
#   sh plant.sh freeze  <film> <start_s> <seconds> <out.mp4>   hold one frame, then carry on where the film is
#   sh plant.sh noisy   <film> <start_s> <seconds> <out.mp4>   the same hold, with fine moving noise over it,
#                                                              like film grain or a texture that never stops
#   sh plant.sh still   <film> <at_s> <out.mp4>                one frame of the film for its whole length
#   sh plant.sh stall   <film> <start_s> <frames> <out.mp4>    stop for a few frames, then resume (a hitch)
#   sh plant.sh shake   <film> <start_s> <seconds> <out.mp4>   shake the whole frame by up to 20 px
#
# The sound is copied unchanged. "freeze", "noisy" and "shake" keep the film's length and timing. "stall" holds
# a frame and then plays on from the next one, so the picture runs a little late after it; the copy is cut to
# the original length.
set -eu
kind=${1:-}; film=${2:-}
[ -n "$kind" ] && [ -n "$film" ] && [ -f "$film" ] || { sed -n '2,15p' "$0"; exit 2; }
fps=$(ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of csv=p=0 "$film" | awk -F/ '{ printf "%.6f", ($2 ? $1/$2 : $1) }')
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$film")
enc="-c:v libx264 -crf 18 -preset veryfast -pix_fmt yuv420p -c:a copy"
frame() { awk -v t="$1" -v f="$fps" 'BEGIN { printf "%d", t * f + 0.5 }'; }

case "$kind" in
  freeze|noisy)
    start=$3; secs=$4; out=$5
    a=$(frame "$start"); b=$(frame "$(awk -v s="$start" -v d="$secs" 'BEGIN { print s + d }')")
    hold="[0:v]split[s][r];[s][r]freezeframes=first=$((a + 1)):last=$b:replace=$a"
    if [ "$kind" = noisy ]; then
      graph="$hold,noise=alls=12:allf=t:enable='between(n,$((a + 1)),$b)'[v]"
    else
      graph="$hold[v]"
    fi
    # shellcheck disable=SC2086
    ffmpeg -v error -y -i "$film" -filter_complex "$graph" -map "[v]" -map "0:a?" $enc "$out" ;;
  still)
    at=$3; out=$4
    png="${out%.*}.frame.png"
    ffmpeg -v error -y -ss "$at" -i "$film" -frames:v 1 "$png"
    # shellcheck disable=SC2086
    ffmpeg -v error -y -loop 1 -framerate "$fps" -i "$png" -i "$film" -map 0:v -map "1:a?" -t "$dur" $enc "$out"
    rm -f "$png" ;;
  stall)
    start=$3; frames=$4; out=$5
    a=$(frame "$start")
    # shellcheck disable=SC2086
    ffmpeg -v error -y -i "$film" -vf "loop=loop=$frames:size=1:start=$a,setpts=N/FRAME_RATE/TB" -t "$dur" $enc "$out" ;;
  shake)
    start=$3; secs=$4; out=$5
    end=$(awk -v s="$start" -v d="$secs" 'BEGIN { print s + d }')
    x="20+if(between(t\\,$start\\,$end)\\,14*sin(n*2.3)+6*sin(n*5.1)\\,0)"
    y="20+if(between(t\\,$start\\,$end)\\,10*cos(n*1.9)+5*sin(n*4.3)\\,0)"
    # shellcheck disable=SC2086
    ffmpeg -v error -y -i "$film" -vf "pad=iw+40:ih+40:20:20,crop=iw-40:ih-40:x='$x':y='$y'" $enc "$out" ;;
  *) sed -n '2,15p' "$0"; exit 2 ;;
esac
echo "wrote $out"
