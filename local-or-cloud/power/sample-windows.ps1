# Streams the GPU's board power and the processor's energy counter, about twice a second, as CSV on standard output:
#   utc_ms, gpu_watts, gpu_util_percent, gpu_memory_mib, cpu_package_picowatt_hours (a running total)
# Run it on the Windows machine with the GPU while a local job runs, and keep the output, for instance:
#   powershell -NoProfile -ExecutionPolicy Bypass -File power\sample-windows.ps1 > power.csv
# or from another computer:  ssh <pc> "powershell -NoProfile -ExecutionPolicy Bypass -Command -" < power/sample-windows.ps1 > power.csv
# Stop it with Ctrl+C (or by ending the ssh session). GPU power comes from nvidia-smi (NVIDIA cards only; a one-second
# average on recent cards, accurate to about 5 W). The processor's energy comes from Windows' Energy Meter counter
# (Intel RAPL, package 0); on machines without it, that column stays empty. Memory, drives, fans and the power
# supply's own losses are not measured.
# Each statement sits on one line, because PowerShell reading a script from standard input runs a multi-line block
# only when it meets a blank line.
$ErrorActionPreference = 'SilentlyContinue'
$EveryMs = 500
$smi = if (Test-Path 'C:\Windows\System32\nvidia-smi.exe') { 'C:\Windows\System32\nvidia-smi.exe' } else { 'nvidia-smi' }
$rapl = $null; try { $rapl = New-Object System.Diagnostics.PerformanceCounter('Energy Meter', 'Energy', 'rapl_package0_pkg', $true); [void]$rapl.RawValue } catch { $rapl = $null }
"utc_ms,gpu_w,gpu_util,gpu_mem_mib,cpu_pkg_pwh"
while ($true) { $t = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); $g = (& $smi --query-gpu=power.draw,utilization.gpu,memory.used --format=csv,noheader,nounits | Select-Object -First 1) -replace '\s', ''; $c = if ($rapl) { $rapl.RawValue } else { '' }; "$t,$g,$c"; [Console]::Out.Flush(); Start-Sleep -Milliseconds $EveryMs }

