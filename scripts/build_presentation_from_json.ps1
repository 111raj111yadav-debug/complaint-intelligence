<#
.SYNOPSIS
    Reads deliverables\presentation_data.json and builds the 15-Slide PowerPoint presentation and PDF.
#>

$ErrorActionPreference = "Stop"

$workspaceRoot = "c:\Users\Rajnish\Desktop\complaint-intelligence"
$jsonPath = Join-Path $workspaceRoot "deliverables\presentation_data.json"
$pptxPath = Join-Path $workspaceRoot "deliverables\Complaint_Intelligence_Faculty_Presentation.pptx"
$pdfPath  = Join-Path $workspaceRoot "deliverables\Complaint_Intelligence_Faculty_Presentation.pdf"

if (-not (Test-Path $jsonPath)) {
    throw "Data file not found: $jsonPath"
}

$rawJson = Get-Content $jsonPath -Raw -Encoding UTF8
$slidesData = ConvertFrom-Json $rawJson

Write-Host "Initializing PowerPoint COM..."
$ppt = New-Object -ComObject PowerPoint.Application
$pres = $ppt.Presentations.Add([Microsoft.Office.Core.MsoTriState]::msoFalse)

# 16:9 Widescreen
$pres.PageSetup.SlideWidth = 960
$pres.PageSetup.SlideHeight = 540

# Colors
$cNavyDark   = 15 + (23 * 256) + (42 * 65536)     # #0F172A
$cNavyCard   = 30 + (41 * 256) + (59 * 65536)     # #1E293B
$cBlueAccent = 37 + (99 * 256) + (235 * 65536)    # #2563EB
$cBlueLight  = 2 + (132 * 256) + (199 * 65536)    # #0284C7
$cTealAccent = 13 + (148 * 256) + (136 * 65536)   # #0D9488
$cGreen      = 4 + (120 * 256) + (87 * 65536)     # #047857
$cWhite      = 255 + (255 * 256) + (255 * 65536)  # #FFFFFF
$cBgLight    = 248 + (250 * 256) + (252 * 65536)  # #F8FAFC
$cBorder     = 226 + (232 * 256) + (240 * 65536)  # #E2E8F0
$cTextDark   = 15 + (23 * 256) + (42 * 65536)     # #0F172A
$cTextMuted  = 71 + (85 * 256) + (105 * 65536)    # #475569

for ($i = 0; $i -lt $slidesData.Count; $i++) {
    $sd = $slidesData[$i]
    $slideNum = $i + 1
    Write-Host "Building Slide $slideNum : $($sd.title)..."
    $slide = $pres.Slides.Add($slideNum, 12) # 12 = ppLayoutBlank

    # Background
    $bg = $slide.Shapes.AddShape(1, 0, 0, 960, 540)
    $bg.Fill.Solid()
    $bg.Fill.ForeColor.RGB = if ($sd.is_dark) { $cNavyDark } else { $cBgLight }
    $bg.Line.Visible = 0

    if (-not $sd.is_dark) {
        # Accent top line
        $topBar = $slide.Shapes.AddShape(1, 0, 0, 960, 5)
        $topBar.Fill.Solid()
        $topBar.Fill.ForeColor.RGB = $cBlueAccent
        $topBar.Line.Visible = 0

        # Title
        $tbTitle = $slide.Shapes.AddTextbox(1, 48, 18, 864, 45)
        $tbTitle.TextFrame.WordWrap = 1
        $tbTitle.TextFrame.MarginLeft = 0; $tbTitle.TextFrame.MarginTop = 0; $tbTitle.TextFrame.MarginRight = 0; $tbTitle.TextFrame.MarginBottom = 0
        $trTitle = $tbTitle.TextFrame.TextRange
        $trTitle.Text = $sd.title
        $trTitle.Font.Name = "Segoe UI"
        $trTitle.Font.Size = 22
        $trTitle.Font.Bold = 1
        $trTitle.Font.Color.RGB = $cTextDark

        # Subtitle
        if ($sd.subtitle) {
            $tbSub = $slide.Shapes.AddTextbox(1, 48, 58, 864, 25)
            $tbSub.TextFrame.WordWrap = 1
            $tbSub.TextFrame.MarginLeft = 0; $tbSub.TextFrame.MarginTop = 0; $tbSub.TextFrame.MarginRight = 0; $tbSub.TextFrame.MarginBottom = 0
            $trSub = $tbSub.TextFrame.TextRange
            $trSub.Text = $sd.subtitle
            $trSub.Font.Name = "Segoe UI"
            $trSub.Font.Size = 11.5
            $trSub.Font.Bold = 1
            $trSub.Font.Color.RGB = $cBlueLight
        }
    }

    # Slide 1 specific content
    if ($sd.slide_num -eq 1) {
        $s1Bar = $slide.Shapes.AddShape(1, 60, 50, 840, 4)
        $s1Bar.Fill.Solid(); $s1Bar.Fill.ForeColor.RGB = $cTealAccent; $s1Bar.Line.Visible = 0

        $tbS1Sub = $slide.Shapes.AddTextbox(1, 60, 65, 840, 30)
        $tbS1Sub.TextFrame.WordWrap = 1
        $tbS1Sub.TextFrame.TextRange.Text = $sd.subtitle
        $tbS1Sub.TextFrame.TextRange.Font.Name = "Segoe UI"
        $tbS1Sub.TextFrame.TextRange.Font.Size = 12
        $tbS1Sub.TextFrame.TextRange.Font.Bold = 1
        $tbS1Sub.TextFrame.TextRange.Font.Color.RGB = $cTealAccent

        $tbS1Title = $slide.Shapes.AddTextbox(1, 60, 105, 840, 125)
        $tbS1Title.TextFrame.WordWrap = 1
        $tbS1Title.TextFrame.TextRange.Text = $sd.title
        $tbS1Title.TextFrame.TextRange.Font.Name = "Segoe UI"
        $tbS1Title.TextFrame.TextRange.Font.Size = 24
        $tbS1Title.TextFrame.TextRange.Font.Bold = 1
        $tbS1Title.TextFrame.TextRange.Font.Color.RGB = $cWhite

        $tbS1Desc = $slide.Shapes.AddTextbox(1, 60, 235, 840, 45)
        $tbS1Desc.TextFrame.WordWrap = 1
        $tbS1Desc.TextFrame.TextRange.Text = $sd.desc
        $tbS1Desc.TextFrame.TextRange.Font.Name = "Segoe UI"
        $tbS1Desc.TextFrame.TextRange.Font.Size = 11.5
        $tbS1Desc.TextFrame.TextRange.Font.Color.RGB = $cBorder

        $metaBox = $slide.Shapes.AddShape(1, 60, 295, 840, 175)
        $metaBox.Fill.Solid(); $metaBox.Fill.ForeColor.RGB = $cNavyCard
        $metaBox.Line.Visible = 1; $metaBox.Line.ForeColor.RGB = $cBorder; $metaBox.Line.Weight = 0.8

        $tbMeta = $slide.Shapes.AddTextbox(1, 80, 310, 800, 145)
        $tbMeta.TextFrame.WordWrap = 1
        $tbMeta.TextFrame.TextRange.Text = $sd.meta
        $tbMeta.TextFrame.TextRange.Font.Name = "Segoe UI"
        $tbMeta.TextFrame.TextRange.Font.Size = 11.5
        $tbMeta.TextFrame.TextRange.Font.Color.RGB = $cWhite
    }

    # Slide 15 specific content
    if ($sd.slide_num -eq 15) {
        $s15Bar = $slide.Shapes.AddShape(1, 60, 45, 840, 4)
        $s15Bar.Fill.Solid(); $s15Bar.Fill.ForeColor.RGB = $cTealAccent; $s15Bar.Line.Visible = 0

        $tb15Title = $slide.Shapes.AddTextbox(1, 60, 58, 840, 45)
        $tb15Title.TextFrame.WordWrap = 1
        $tb15Title.TextFrame.TextRange.Text = $sd.title
        $tb15Title.TextFrame.TextRange.Font.Name = "Segoe UI"
        $tb15Title.TextFrame.TextRange.Font.Size = 23
        $tb15Title.TextFrame.TextRange.Font.Bold = 1
        $tb15Title.TextFrame.TextRange.Font.Color.RGB = $cWhite

        if ($sd.cards_dark) {
            foreach ($cd in $sd.cards_dark) {
                $cBox = $slide.Shapes.AddShape(1, $cd.x, $cd.y, $cd.w, $cd.h)
                $cBox.Fill.Solid(); $cBox.Fill.ForeColor.RGB = $cNavyCard
                $cBox.Line.Visible = 1; $cBox.Line.ForeColor.RGB = $cBorder; $cBox.Line.Weight = 0.8

                $cBar = $slide.Shapes.AddShape(1, $cd.x, $cd.y, $cd.w, 4)
                $cBar.Fill.Solid(); $cBar.Fill.ForeColor.RGB = $cd.accent; $cBar.Line.Visible = 0

                $cTb = $slide.Shapes.AddTextbox(1, ($cd.x + 10), ($cd.y + 12), ($cd.w - 20), ($cd.h - 20))
                $cTb.TextFrame.WordWrap = 1
                $cTb.TextFrame.MarginLeft = 0; $cTb.TextFrame.MarginTop = 0; $cTb.TextFrame.MarginRight = 0; $cTb.TextFrame.MarginBottom = 0
                $tr = $cTb.TextFrame.TextRange
                $tr.Text = "$($cd.title)`n`n$($cd.body)"
                $tr.Font.Name = "Segoe UI"
                $tr.Font.Size = 10
                $tr.Font.Color.RGB = $cWhite
                $tr.Paragraphs(1).Font.Bold = 1
                $tr.Paragraphs(1).Font.Size = 11.5
                $tr.Paragraphs(1).Font.Color.RGB = $cd.accent
            }
        }

        if ($sd.quote_banner) {
            $qb = $sd.quote_banner
            $qBox = $slide.Shapes.AddShape(1, $qb.x, $qb.y, $qb.w, $qb.h)
            $qBox.Fill.Solid(); $qBox.Fill.ForeColor.RGB = $qb.bg
            $qBox.Line.Visible = 1; $qBox.Line.ForeColor.RGB = $cTealAccent; $qBox.Line.Weight = 1.2

            $qTb = $slide.Shapes.AddTextbox(1, ($qb.x + 15), ($qb.y + 10), ($qb.w - 30), ($qb.h - 20))
            $qTb.TextFrame.WordWrap = 1
            $qTb.TextFrame.TextRange.Text = $qb.text
            $qTb.TextFrame.TextRange.Font.Name = "Segoe UI"
            $qTb.TextFrame.TextRange.Font.Size = 11
            $qTb.TextFrame.TextRange.Font.Italic = 1
            $qTb.TextFrame.TextRange.Font.Color.RGB = $cWhite
        }

        if ($sd.thanks) {
            $th = $sd.thanks
            $tbTh = $slide.Shapes.AddTextbox(1, $th.x, $th.y, $th.w, $th.h)
            $tbTh.TextFrame.WordWrap = 1
            $tbTh.TextFrame.TextRange.Text = $th.text
            $tbTh.TextFrame.TextRange.Font.Name = "Segoe UI"
            $tbTh.TextFrame.TextRange.Font.Size = 13
            $tbTh.TextFrame.TextRange.Font.Bold = 1
            $tbTh.TextFrame.TextRange.Font.Color.RGB = $th.color
            $tbTh.TextFrame.TextRange.ParagraphFormat.Alignment = 2 # Center
        }
    }

    # Regular Cards
    if ($sd.cards) {
        foreach ($card in $sd.cards) {
            $cardShape = $slide.Shapes.AddShape(1, $card.x, $card.y, $card.w, $card.h)
            $cardShape.Fill.Solid()
            $cardShape.Fill.ForeColor.RGB = $cWhite
            $cardShape.Line.Visible = 1
            $cardShape.Line.ForeColor.RGB = $cBorder
            $cardShape.Line.Weight = 1.2

            if ($card.accent) {
                $accBar = $slide.Shapes.AddShape(1, $card.x, $card.y, $card.w, 4)
                $accBar.Fill.Solid()
                $accBar.Fill.ForeColor.RGB = $card.accent
                $accBar.Line.Visible = 0
            }

            $cText = $slide.Shapes.AddTextbox(1, ($card.x + 12), ($card.y + 12), ($card.w - 24), ($card.h - 20))
            $cText.TextFrame.WordWrap = 1
            $cText.TextFrame.MarginLeft = 0; $cText.TextFrame.MarginTop = 0; $cText.TextFrame.MarginRight = 0; $cText.TextFrame.MarginBottom = 0
            $trC = $cText.TextFrame.TextRange

            $trC.Text = "$($card.title)`n`n$($card.body)"
            $trC.Font.Name = "Segoe UI"
            $trC.Font.Size = 9.8
            $trC.Font.Color.RGB = $cTextMuted
            $trC.Paragraphs(1).Font.Bold = 1
            $trC.Paragraphs(1).Font.Size = 11.5
            $trC.Paragraphs(1).Font.Color.RGB = if ($card.accent) { $card.accent } else { $cTextDark }
        }
    }

    # Embedded Image
    if ($sd.image) {
        $img = $sd.image
        if (Test-Path $img.path) {
            $slide.Shapes.AddPicture($img.path, 0, 1, $img.x, $img.y, $img.w, $img.h) | Out-Null
        }
    }

    # Embedded Table
    if ($sd.table) {
        $tblData = $sd.table
        $rowCount = $tblData.rows.Count + 1
        $colCount = $tblData.headers.Count
        $tblShape = $slide.Shapes.AddTable($rowCount, $colCount, $tblData.x, $tblData.y, $tblData.w, $tblData.h)
        $t = $tblShape.Table

        for ($c = 0; $c -lt $colCount; $c++) {
            $cell = $t.Cell(1, $c + 1).Shape
            $cell.Fill.Solid(); $cell.Fill.ForeColor.RGB = $cBorder
            $cell.TextFrame.TextRange.Text = $tblData.headers[$c]
            $cell.TextFrame.TextRange.Font.Name = "Segoe UI"
            $cell.TextFrame.TextRange.Font.Size = 9.5
            $cell.TextFrame.TextRange.Font.Bold = 1
            $cell.TextFrame.TextRange.Font.Color.RGB = $cTextDark
        }

        for ($r = 0; $r -lt $tblData.rows.Count; $r++) {
            for ($c = 0; $c -lt $colCount; $c++) {
                $cell = $t.Cell($r + 2, $c + 1).Shape
                $cell.TextFrame.TextRange.Text = [string]$tblData.rows[$r][$c]
                $cell.TextFrame.TextRange.Font.Name = "Segoe UI"
                $cell.TextFrame.TextRange.Font.Size = 9
                $cell.TextFrame.TextRange.Font.Color.RGB = $cTextDark
            }
        }
    }

    # Metrics Bar
    if ($sd.metrics_bar) {
        $mb = $sd.metrics_bar
        $mShape = $slide.Shapes.AddShape(1, $mb.x, $mb.y, $mb.w, $mb.h)
        $mShape.Fill.Solid(); $mShape.Fill.ForeColor.RGB = $mb.bg
        $mShape.Line.Visible = 0

        $mTb = $slide.Shapes.AddTextbox(1, ($mb.x + 10), ($mb.y + 6), ($mb.w - 20), ($mb.h - 12))
        $mTb.TextFrame.WordWrap = 1
        $mTb.TextFrame.TextRange.Text = $mb.text
        $mTb.TextFrame.TextRange.Font.Name = "Segoe UI"
        $mTb.TextFrame.TextRange.Font.Size = 9.8
        $mTb.TextFrame.TextRange.Font.Bold = 1
        $mTb.TextFrame.TextRange.Font.Color.RGB = $mb.color
    }

    # Bottom Banner
    if ($sd.bottom_banner) {
        $bb = $sd.bottom_banner
        $bShape = $slide.Shapes.AddShape(1, $bb.x, $bb.y, $bb.w, $bb.h)
        $bShape.Fill.Solid(); $bShape.Fill.ForeColor.RGB = $bb.bg
        $bShape.Line.Visible = 0

        $bTb = $slide.Shapes.AddTextbox(1, ($bb.x + 12), ($bb.y + 8), ($bb.w - 24), ($bb.h - 16))
        $bTb.TextFrame.WordWrap = 1
        $bTb.TextFrame.TextRange.Text = $bb.text
        $bTb.TextFrame.TextRange.Font.Name = "Segoe UI"
        $bTb.TextFrame.TextRange.Font.Size = 10.5
        $bTb.TextFrame.TextRange.Font.Bold = 1
        $bTb.TextFrame.TextRange.Font.Color.RGB = $bb.color
    }

    # Example Box (Slide 6)
    if ($sd.example_box) {
        $eb = $sd.example_box
        $eShape = $slide.Shapes.AddShape(1, $eb.x, $eb.y, $eb.w, $eb.h)
        $eShape.Fill.Solid(); $eShape.Fill.ForeColor.RGB = $cWhite
        $eShape.Line.Visible = 1; $eShape.Line.ForeColor.RGB = $cBorder; $eShape.Line.Weight = 1.2

        $eTb = $slide.Shapes.AddTextbox(1, ($eb.x + 12), ($eb.y + 8), ($eb.w - 24), ($eb.h - 16))
        $eTb.TextFrame.WordWrap = 1
        $fullText = "$($eb.title)`n$($eb.raw)`n`n$($eb.sanitized)`n`n$($eb.tfidf)`n$($eb.ngrams)"
        $eTb.TextFrame.TextRange.Text = $fullText
        $eTb.TextFrame.TextRange.Font.Name = "Segoe UI"
        $eTb.TextFrame.TextRange.Font.Size = 9.5
        $eTb.TextFrame.TextRange.Font.Color.RGB = $cTextDark
        $eTb.TextFrame.TextRange.Paragraphs(1).Font.Bold = 1
        $eTb.TextFrame.TextRange.Paragraphs(1).Font.Color.RGB = $cBlueAccent
    }

    # Speaker Notes
    if ($sd.speaker_notes) {
        try {
            $slide.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = $sd.speaker_notes
        } catch {
            Write-Warning "Could not set notes for slide $slideNum : $_"
        }
    }
}

Write-Host "Saving presentation to $pptxPath..."
$pres.SaveAs($pptxPath)

Write-Host "Exporting presentation to $pdfPath..."
$pres.SaveAs($pdfPath, 32) # 32 = ppSaveAsPDF

$pres.Close()
$ppt.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null

Write-Host "Presentation generation completed!"
Write-Host "PPTX Exists: $(Test-Path $pptxPath) (Size: $((Get-Item $pptxPath).Length) bytes)"
Write-Host "PDF Exists:  $(Test-Path $pdfPath)  (Size: $((Get-Item $pdfPath).Length) bytes)"
