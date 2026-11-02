param([string]$Repository = 'yinzhenCoder/remember-desktop')
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repositoryRoot
function Invoke-GitChecked {
    & git -c credential.helper= -c 'credential.helper=!gh auth git-credential' @args
    if ($LASTEXITCODE -ne 0) { throw 'Git operation failed. Check the output above.' }
}
gh auth status
if ($LASTEXITCODE -ne 0) { throw 'Run gh auth login in this terminal first.' }
Invoke-GitChecked push -u origin main

# Uses GitHub CLI credentials through its credential helper. No token files are created.
gh api "repos/$Repository/pages" --silent 2>$null
if ($LASTEXITCODE -eq 0) {
    gh api "repos/$Repository/pages" --method PUT -f build_type=workflow --silent
} else {
    gh api "repos/$Repository/pages" --method POST -f build_type=workflow --silent
}
if ($LASTEXITCODE -ne 0) { throw 'Source was pushed, but enabling GitHub Pages failed.' }
gh repo edit $Repository --enable-wiki
if ($LASTEXITCODE -ne 0) { throw 'Could not enable the Wiki.' }

$wikiUrl = "https://github.com/$Repository.wiki.git"
& git -c credential.helper= -c 'credential.helper=!gh auth git-credential' ls-remote $wikiUrl 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    $wikiDirectory = Join-Path $repositoryRoot '.cache/wiki-publish'
    if (Test-Path -LiteralPath $wikiDirectory) {
        Invoke-GitChecked -C $wikiDirectory pull --ff-only
    } else {
        Invoke-GitChecked clone $wikiUrl $wikiDirectory
    }
    Get-ChildItem -LiteralPath (Join-Path $repositoryRoot 'wiki') -Filter '*.md' | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $wikiDirectory -Force
    }
    Invoke-GitChecked -C $wikiDirectory config user.name yinzhenCoder
    Invoke-GitChecked -C $wikiDirectory config user.email 103433338+yinzhenCoder@users.noreply.github.com
    Invoke-GitChecked -C $wikiDirectory add .
    & git -C $wikiDirectory diff --cached --quiet
    if ($LASTEXITCODE -eq 1) { Invoke-GitChecked -C $wikiDirectory commit -m 'Publish user and developer documentation' }
    Invoke-GitChecked -C $wikiDirectory push
} else {
    Write-Warning "Wiki source is uploaded in the main repository. Create a Home page at https://github.com/$Repository/wiki, then run this script again to publish the native Wiki."
}
gh workflow run docs.yml --ref main --repo $Repository
if ($LASTEXITCODE -ne 0) { Write-Warning 'If documentation is not already building, run the Documentation workflow from the Actions tab.' }
Write-Output "Repository: https://github.com/$Repository"
Write-Output 'Documentation: https://yinzhenCoder.github.io/remember-desktop/'
