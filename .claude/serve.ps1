param([int]$Port = 5680)

# Simpel lokal server til preview (projektets rodmappe)
$root = Split-Path $PSScriptRoot -Parent
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$Port/"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css'
  '.js'   = 'application/javascript'
  '.ico'  = 'image/x-icon'
  '.png'  = 'image/png'
  '.svg'  = 'image/svg+xml'
}

while ($listener.IsListening) {
  $ctx  = $listener.GetContext()
  $req  = $ctx.Request
  $resp = $ctx.Response
  $isHead = $req.HttpMethod -eq 'HEAD'

  try {
    $urlPath = $req.Url.LocalPath
    Write-Host "$($req.HttpMethod) $urlPath"

    if ($urlPath -eq '/') { $urlPath = '/index.html' }
    $rel  = $urlPath.TrimStart('/') -replace '/', [IO.Path]::DirectorySeparatorChar
    $file = Join-Path $root $rel

    if (Test-Path $file -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext   = [IO.Path]::GetExtension($file).ToLower()
      $resp.ContentType     = if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' }
      $resp.ContentLength64 = $bytes.LongLength
      if (-not $isHead) { $resp.OutputStream.Write($bytes, 0, $bytes.Length) }
    } else {
      $msg = [Text.Encoding]::UTF8.GetBytes("404 Not found: $urlPath")
      $resp.StatusCode      = 404
      $resp.ContentType     = 'text/plain'
      $resp.ContentLength64 = $msg.LongLength
      if (-not $isHead) { $resp.OutputStream.Write($msg, 0, $msg.Length) }
    }
  } catch {
    Write-Host "Error: $_"
    try { $resp.Abort() } catch {}
  } finally {
    try { $resp.OutputStream.Close() } catch {}
  }
}
