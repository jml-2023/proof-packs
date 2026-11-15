#!/usr/bin/env bash
# Streams the GPU's board power about twice a second, as CSV on standard output (the same columns as
# sample-windows.ps1; the processor column stays empty):
#   utc_ms, gpu_watts, gpu_util_percent, gpu_memory_mib, cpu_package_picowatt_hours
# Run it on the Linux machine with the GPU while a local job runs:  bash power/sample-linux.sh > power.csv
# NVIDIA cards only. To add the processor on Linux, read /sys/class/powercap/intel-rapl:0/energy_uj (microjoules;
# it usually needs root) and convert to picowatt-hours (1 uJ = 1e6 / 3600 pWh).
echo "utc_ms,gpu_w,gpu_util,gpu_mem_mib,cpu_pkg_pwh"
nvidia-smi --query-gpu=power.draw,utilization.gpu,memory.used --format=csv,noheader,nounits -lms "${EVERY_MS:-500}" |
  while IFS= read -r line; do echo "$(date +%s%3N),${line// /},"; done
