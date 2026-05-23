$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://*:8080/")
$listener.Start()
Write-Host "========================================="
Write-Host "  Server is running!"
Write-Host "  Local:   http://localhost:8080"
Write-Host "  Network: http://192.168.1.13:8080"
Write-Host "========================================="
Write-Host "Open the Network URL on your phone browser"
Write-Host "Press Ctrl+C to stop the server"
Write-Host ""

$basePath = "c:\Users\Administrator\Desktop\Mobile_App"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $localPath = $request.Url.LocalPath

    if ($localPath -eq "/") { $localPath = "/index.html" }

    $filePath = Join-Path $basePath ($localPath.TrimStart("/").Replace("/", "\"))

    if (Test-Path $filePath) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
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
            default { "application/octet-stream" }
        }

        $response.ContentType = $mime
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        Write-Host "[200] $localPath"
    } else {
        $response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $response.OutputStream.Write($msg, 0, $msg.Length)
        Write-Host "[404] $localPath"
    }

    $response.Close()
}
