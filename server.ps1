$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://*:8080/")
$listener.Start()

$basePath = $PSScriptRoot
$watchExts = @(".html", ".css", ".js", ".json")

# Calculate initial hash of all watched files
function Get-FilesHash {
    $hash = ""
    Get-ChildItem $basePath -File | Where-Object { $watchExts -contains $_.Extension.ToLower() } | ForEach-Object {
        $hash += $_.Name + ":" + $_.LastWriteTime.Ticks.ToString() + ";"
    }
    return $hash
}

$script:lastHash = Get-FilesHash

# Live reload script to inject into HTML
$liveReloadScript = @"
<script>
(function(){
  var lastHash = '';
  setInterval(function(){
    fetch('/__livereload')
      .then(function(r){ return r.text(); })
      .then(function(h){
        if(lastHash && lastHash !== h){ location.reload(); }
        lastHash = h;
      })
      .catch(function(){});
  }, 1000);
})();
</script>
"@

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Live Reload Server is running!" -ForegroundColor Green
Write-Host "  Local:   http://localhost:8080" -ForegroundColor Yellow
Write-Host "  Network: http://192.168.1.13:8080" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Auto-refresh ON: edit files and the" -ForegroundColor Magenta
Write-Host "  browser will reload automatically!" -ForegroundColor Magenta
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor DarkGray
Write-Host ""

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $localPath = $request.Url.LocalPath

    # Live reload polling endpoint
    if ($localPath -eq "/__livereload") {
        $script:lastHash = Get-FilesHash
        $hashBytes = [System.Text.Encoding]::UTF8.GetBytes($script:lastHash)
        $response.ContentType = "text/plain"
        $response.ContentLength64 = $hashBytes.Length
        $response.OutputStream.Write($hashBytes, 0, $hashBytes.Length)
        $response.Close()
        continue
    }

    if ($localPath -eq "/") { $localPath = "/index.html" }

    $filePath = Join-Path $basePath ($localPath.TrimStart("/").Replace("/", "\"))

    if (Test-Path $filePath) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()

        $mime = switch ($ext) {
            ".html" { "text/html; charset=utf-8" }
            ".css"  { "text/css; charset=utf-8" }
            ".js"   { "application/javascript; charset=utf-8" }
            ".json" { "application/json; charset=utf-8" }
            ".png"  { "image/png" }
            ".jpg"  { "image/jpeg" }
            ".svg"  { "image/svg+xml" }
            ".webp" { "image/webp" }
            ".ico"  { "image/x-icon" }
            default { "application/octet-stream" }
        }

        if ($ext -eq ".html") {
            # Inject live reload script into HTML before </body>
            $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
            $content = $content.Replace("</body>", "$liveReloadScript`n</body>")
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
        } else {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
        }

        $response.ContentType = $mime
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        Write-Host "[200] $localPath" -ForegroundColor Green
    } else {
        $response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $response.OutputStream.Write($msg, 0, $msg.Length)
        Write-Host "[404] $localPath" -ForegroundColor Red
    }

    $response.Close()
}
