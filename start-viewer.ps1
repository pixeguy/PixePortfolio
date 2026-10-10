$ErrorActionPreference = 'Stop'

$siteRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$basePath = $siteRoot.TrimEnd('\') + '\'
$prefix = 'http://127.0.0.1:8000/'
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)

$contentTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.fbx'  = 'application/octet-stream'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

try {
  $listener.Start()
  $url = $prefix
  Write-Host "Serving this folder at $url" -ForegroundColor Cyan
  Write-Host 'Keep this window open while viewing. Press Ctrl+C to stop.' -ForegroundColor DarkGray
  Start-Process $url

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = 'index.html' }
    $candidate = [IO.Path]::GetFullPath((Join-Path $siteRoot $relativePath))

    if (-not $candidate.StartsWith($basePath, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $body = [Text.Encoding]::UTF8.GetBytes('Not found')
    } else {
      $extension = [IO.Path]::GetExtension($candidate).ToLowerInvariant()
      if ($contentTypes.ContainsKey($extension)) {
        $context.Response.ContentType = $contentTypes[$extension]
      } else {
        $context.Response.ContentType = 'application/octet-stream'
      }
      $body = [IO.File]::ReadAllBytes($candidate)
      $context.Response.StatusCode = 200
    }

    $context.Response.ContentLength64 = $body.Length
    $context.Response.OutputStream.Write($body, 0, $body.Length)
    $context.Response.Close()
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
