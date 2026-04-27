# register-webhook.ps1
# One-time registration of webhook subscription with Payroc UAT
#
# Per Payroc docs:
# https://docs.payroc.com/guides/board-merchants/event-subscriptions/create-an-event-subscription
#
# Required env vars (set before running):
#   $env:PAYROC_API_KEY        - Payroc UAT API key (x-api-key header)
#   $env:PAYROC_WEBHOOK_SECRET - The shared secret Payroc will return in the
#                                payroc-secret header on every webhook request.
#                                Generate fresh: [guid]::NewGuid().ToString("N")
#                                MUST also be set as PAYROC_WEBHOOK_SECRET in Vercel.
#   $env:WEBHOOK_URI           - (Optional) Receiver URL. Defaults to production.
#   $env:WEBHOOK_SUPPORT_EMAIL - (Optional) Defaults to ceo@36west.org

if (-not $env:PAYROC_API_KEY) {
  Write-Error "PAYROC_API_KEY not set in session. Set it before running."
  exit 1
}
if (-not $env:PAYROC_WEBHOOK_SECRET) {
  Write-Error "PAYROC_WEBHOOK_SECRET not set in session. Set it before running."
  Write-Error "Generate one: [guid]::NewGuid().ToString('N')"
  Write-Error "Set the SAME value in Vercel env vars as PAYROC_WEBHOOK_SECRET."
  exit 1
}

$webhookUri = if ($env:WEBHOOK_URI) { $env:WEBHOOK_URI } else { "https://portal.salontransact.com/api/webhooks/payroc" }
$supportEmail = if ($env:WEBHOOK_SUPPORT_EMAIL) { $env:WEBHOOK_SUPPORT_EMAIL } else { "ceo@36west.org" }

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Webhook URI: $webhookUri"
Write-Host "  Support email: $supportEmail"
Write-Host "  Secret length: $($env:PAYROC_WEBHOOK_SECRET.Length) chars"
Write-Host ""

# Step 1: Get a bearer token from Payroc UAT
Write-Host "Step 1/2: Requesting bearer token from Payroc UAT..." -ForegroundColor Cyan

try {
  $tokenResponse = Invoke-WebRequest `
    -Uri "https://identity.uat.payroc.com/authorize" `
    -Method POST `
    -Headers @{
      "x-api-key" = $env:PAYROC_API_KEY
      "Content-Type" = "application/json"
    } `
    -UseBasicParsing
} catch {
  Write-Host ""
  Write-Host "FAILED to get bearer token" -ForegroundColor Red
  Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
  try {
    $errorStream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($errorStream)
    Write-Host "Body: $($reader.ReadToEnd())"
  } catch { }
  exit 1
}

if ($tokenResponse.StatusCode -ne 200) {
  Write-Error "Bearer token request returned HTTP $($tokenResponse.StatusCode)"
  Write-Error $tokenResponse.Content
  exit 1
}

# CRITICAL: parse the response (bug fix vs prior version)
$tokenData = $tokenResponse.Content | ConvertFrom-Json
$bearerToken = $tokenData.access_token

if (-not $bearerToken) {
  Write-Error "No access_token in response. Available fields:"
  $tokenData | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name | Out-String | Write-Error
  exit 1
}

Write-Host "  Bearer token acquired (length: $($bearerToken.Length))" -ForegroundColor Green
Write-Host ""

# Step 2: Create the event subscription
Write-Host "Step 2/2: Creating event subscription..." -ForegroundColor Cyan

# Per Payroc docs, the schema is: enabled/eventTypes/notifications[]
$subscriptionBody = @{
  enabled = $true
  eventTypes = @(
    "processingAccount.status.changed"
    "terminalOrder.status.changed"
  )
  notifications = @(
    @{
      type = "webhook"
      uri = $webhookUri
      secret = $env:PAYROC_WEBHOOK_SECRET
      supportEmailAddress = $supportEmail
    }
  )
}

$subscriptionPayload = $subscriptionBody | ConvertTo-Json -Compress -Depth 5
$idempotencyKey = [guid]::NewGuid().ToString()

$subscriptionHeaders = @{
  "Authorization" = "Bearer $bearerToken"
  "Content-Type" = "application/json"
  "Idempotency-Key" = $idempotencyKey
}

Write-Host "  Idempotency-Key: $idempotencyKey"
Write-Host "  Endpoint: https://api.uat.payroc.com/v1/event-subscriptions"
Write-Host ""

try {
  $subResponse = Invoke-WebRequest `
    -Uri "https://api.uat.payroc.com/v1/event-subscriptions" `
    -Method POST `
    -Headers $subscriptionHeaders `
    -Body $subscriptionPayload `
    -UseBasicParsing

  Write-Host "SUCCESS" -ForegroundColor Green
  Write-Host "  Status: $($subResponse.StatusCode)"
  Write-Host ""
  Write-Host "RESPONSE:" -ForegroundColor Cyan
  $responseObj = $subResponse.Content | ConvertFrom-Json
  $responseObj | ConvertTo-Json -Depth 10
  Write-Host ""
  Write-Host "================================================" -ForegroundColor Yellow
  Write-Host "SUBSCRIPTION ID: $($responseObj.id)" -ForegroundColor Yellow
  Write-Host "================================================" -ForegroundColor Yellow
  Write-Host "Save this ID. You need it to update or delete the subscription later."

} catch {
  Write-Host "FAILED" -ForegroundColor Red
  Write-Host "  Status: $($_.Exception.Response.StatusCode.value__)"
  Write-Host "  Status Description: $($_.Exception.Response.StatusDescription)"

  try {
    $errorStream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($errorStream)
    $errorBody = $reader.ReadToEnd()
    Write-Host ""
    Write-Host "Response body:" -ForegroundColor Red
    Write-Host $errorBody
  } catch {
    Write-Host "  (Could not read error body)"
  }

  Write-Host ""
  Write-Host "Idempotency-Key was: $idempotencyKey"
  Write-Host "If retrying with same idempotency key, you'll get the same response."
  Write-Host "If you actually want to retry, use a fresh key."
  exit 1
}
