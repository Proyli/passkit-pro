param(
  [string]$Source = "../public/0S2A8207.png",
  [string]$Out1 = "../passes/alcazaren.pass/strip.png",
  [string]$Out2 = "../passes/alcazaren.pass/strip@2x.png",
  [int]$W1 = 624,
  [int]$H1 = 168,
  [int]$W2 = 1248,
  [int]$H2 = 336
)

Add-Type -AssemblyName System.Drawing

function New-CoverImage {
  param(
    [string]$InputPath,
    [string]$OutputPath,
    [int]$TargetW,
    [int]$TargetH
  )
  if (-not (Test-Path $InputPath)) { throw "No existe la imagen fuente: $InputPath" }
  $img = [System.Drawing.Image]::FromFile((Resolve-Path $InputPath))
  try {
    $W = [double]$img.Width
    $H = [double]$img.Height
    $rTarget = $TargetW / $TargetH
    $rImg = $W / $H

    if ($rImg -gt $rTarget) {
      # recortar ancho
      $newW = [int]([math]::Round($H * $rTarget))
      $x = [int](($W - $newW) / 2)
      $cropRect = New-Object System.Drawing.Rectangle($x, 0, $newW, [int]$H)
    } else {
      # recortar alto
      $newH = [int]([math]::Round($W / $rTarget))
      $y = [int](($H - $newH) / 2)
      $cropRect = New-Object System.Drawing.Rectangle(0, $y, [int]$W, $newH)
    }

    $bmpCrop = New-Object System.Drawing.Bitmap($cropRect.Width, $cropRect.Height)
    $g1 = [System.Drawing.Graphics]::FromImage($bmpCrop)
    $g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g1.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g1.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g1.DrawImage($img, (New-Object System.Drawing.Rectangle(0,0,$bmpCrop.Width,$bmpCrop.Height)), $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g1.Dispose()

    $bmpOut = New-Object System.Drawing.Bitmap($TargetW, $TargetH)
    $g2 = [System.Drawing.Graphics]::FromImage($bmpOut)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g2.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g2.DrawImage($bmpCrop, 0, 0, $TargetW, $TargetH)
    $g2.Dispose()

    $dir = Split-Path -Parent $OutputPath
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $outPathFinal = [System.IO.Path]::Combine((Resolve-Path -LiteralPath $dir).Path, (Split-Path -Leaf $OutputPath))
    $bmpOut.Save($outPathFinal, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpCrop.Dispose()
    $bmpOut.Dispose()
  } finally {
    $img.Dispose()
  }
}

Write-Host "→ Generando strips desde: $Source"
New-CoverImage -InputPath $Source -OutputPath $Out1 -TargetW $W1 -TargetH $H1
New-CoverImage -InputPath $Source -OutputPath $Out2 -TargetW $W2 -TargetH $H2

Write-Host "OK:" (Get-Item $Out1).FullName ((Get-Item $Out1).Length/1KB).ToString("0") "KB"
Write-Host "OK:" (Get-Item $Out2).FullName ((Get-Item $Out2).Length/1KB).ToString("0") "KB"
