$ErrorActionPreference = "Stop"

$env:COPILOT_PROVIDER_TYPE = "anthropic"
$env:COPILOT_PROVIDER_BASE_URL = "https://api.deepseek.com/anthropic"
$env:COPILOT_MODEL = if ($env:COPILOT_MODEL) { $env:COPILOT_MODEL } else { "deepseek-v4-pro" }
$env:COPILOT_PROVIDER_MAX_PROMPT_TOKENS = "840000"
$env:COPILOT_PROVIDER_MAX_OUTPUT_TOKENS = "128000"

# Copilot CLI gives COPILOT_PROVIDER_BEARER_TOKEN precedence over API_KEY.
# Clear generic provider credentials so old/revoked tokens cannot override the
# DeepSeek key below. Set DEEPSEEK_API_KEY if you want a persistent shortcut.
Remove-Item Env:COPILOT_PROVIDER_BEARER_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:COPILOT_PROVIDER_API_KEY -ErrorAction SilentlyContinue

if ($env:DEEPSEEK_API_KEY) {
  $env:COPILOT_PROVIDER_API_KEY = $env:DEEPSEEK_API_KEY.Trim()
} else {
  $secureKey = Read-Host "Paste your DeepSeek API key for this terminal session" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  try {
    $env:COPILOT_PROVIDER_API_KEY = ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)).Trim()
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

Write-Host "Starting GitHub Copilot CLI with DeepSeek model $env:COPILOT_MODEL..."
copilot
