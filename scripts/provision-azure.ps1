#!/usr/bin/env pwsh
# =============================================================================
# Azure Infrastructure Provisioning Script — fivekapp / iteration1
# =============================================================================
# Prerequisites:
#   1. Azure CLI installed: https://aka.ms/installazurecliwindows
#   2. Run: az login
#   3. Run this script: .\scripts\provision-azure.ps1
#
# What this creates:
#   - Resource Group
#   - Azure PostgreSQL Flexible Server + database
#   - Azure App Service Plan + Web App (Node.js 20)
#   - Azure Storage Account + blob container for uploads
#   - Azure CDN profile + endpoint for static assets
#   - App Service environment variables (auto-configured)
#   - Outputs all connection strings and env vars needed
# =============================================================================

param(
    [string]$AppName        = "fivekapp",          # Must be globally unique → becomes <AppName>.azurewebsites.net
    [string]$ResourceGroup  = "fivekapp-rg",
    [string]$Location       = "australiaeast",     # Change to your preferred region
    [string]$DbAdminUser    = "fivekadmin",
    [string]$DbAdminPass    = "",                  # Leave blank to be prompted securely
    [string]$DbName         = "iteration1",
    [string]$TenantId       = "",                  # Target Azure AD tenant ID (leave blank to use current login)
    [string]$SubscriptionId = ""                   # Target subscription ID (leave blank to use default)
)

# ── Validate Azure CLI ─────────────────────────────────────────────────────────
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Azure CLI not found. Install from: https://aka.ms/installazurecliwindows"
    exit 1
}

# Check login — target specific tenant if provided
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Not logged in. Running az login..." -ForegroundColor Yellow
    if ($TenantId) {
        az login --tenant $TenantId
    } else {
        az login
    }
    $account = az account show | ConvertFrom-Json
} elseif ($TenantId -and $account.tenantId -ne $TenantId) {
    Write-Host "Current login is tenant $($account.tenantId). Re-authenticating to target tenant $TenantId..." -ForegroundColor Yellow
    az login --tenant $TenantId
    $account = az account show | ConvertFrom-Json
}

# Switch to the target subscription if specified
if ($SubscriptionId) {
    Write-Host "Setting active subscription to: $SubscriptionId" -ForegroundColor Yellow
    az account set --subscription $SubscriptionId
    $account = az account show | ConvertFrom-Json
}

Write-Host "Using tenant:       $($account.tenantId)" -ForegroundColor Cyan
Write-Host "Using subscription: $($account.name) ($($account.id))" -ForegroundColor Cyan

# Prompt for DB password if not provided
if (-not $DbAdminPass) {
    $secPass = Read-Host "Enter PostgreSQL admin password (min 8 chars, upper+lower+number+symbol)" -AsSecureString
    $DbAdminPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
    )
}

$DbServerName = "$AppName-db"
$StorageAccountName = ($AppName -replace '[^a-z0-9]', '') + "storage"  # storage names: lowercase alphanumeric only
$AppServicePlan = "$AppName-plan"
$CdnProfileName = "$AppName-cdn"
$CdnEndpointName = "$AppName-assets"

Write-Host "`n=== Provisioning Azure Resources ===" -ForegroundColor Green
Write-Host "App Name:       $AppName"
Write-Host "Resource Group: $ResourceGroup"
Write-Host "Location:       $Location"
Write-Host "DB Server:      $DbServerName"
Write-Host "Storage:        $StorageAccountName"
Write-Host "CDN:            $CdnEndpointName.azureedge.net"
Write-Host ""

# ── 0. Register required resource providers ───────────────────────────────────
Write-Host "[0/9] Registering required resource providers..." -ForegroundColor Yellow
$providers = @("Microsoft.DBforPostgreSQL", "Microsoft.Web", "Microsoft.Storage", "Microsoft.Cdn")
foreach ($p in $providers) {
    $state = az provider show --namespace $p --query "registrationState" --output tsv 2>$null
    if ($state -ne "Registered") {
        Write-Host "      Registering $p ..." -ForegroundColor Yellow
        az provider register --namespace $p --wait --output none
        Write-Host "      [OK] $p registered" -ForegroundColor Green
    } else {
        Write-Host "      [OK] $p already registered" -ForegroundColor Green
    }
}

# ── 1. Resource Group ──────────────────────────────────────────────────────────
Write-Host "[1/9] Creating resource group..." -ForegroundColor Yellow
az group create `
    --name $ResourceGroup `
    --location $Location `
    --output none

Write-Host "      [OK] Resource group: $ResourceGroup" -ForegroundColor Green

# ── 2. PostgreSQL Flexible Server ─────────────────────────────────────────────
Write-Host "[2/9] Creating PostgreSQL Flexible Server (this takes ~5 mins)..." -ForegroundColor Yellow
az postgres flexible-server create `
    --resource-group $ResourceGroup `
    --name $DbServerName `
    --location $Location `
    --admin-user $DbAdminUser `
    --admin-password $DbAdminPass `
    --sku-name Standard_B1ms `
    --tier Burstable `
    --storage-size 32 `
    --version 16 `
    --yes `
    --output none

Write-Host "      [OK] PostgreSQL server: $DbServerName" -ForegroundColor Green

# ── 3. Create database ─────────────────────────────────────────────────────────
Write-Host "[3/9] Creating database '$DbName'..." -ForegroundColor Yellow
az postgres flexible-server db create `
    --resource-group $ResourceGroup `
    --server-name $DbServerName `
    --database-name $DbName `
    --output none

Write-Host "      [OK] Database: $DbName" -ForegroundColor Green

# Allow Azure services to connect to the DB
az postgres flexible-server firewall-rule create `
    --resource-group $ResourceGroup `
    --name $DbServerName `
    --rule-name AllowAzureServices `
    --start-ip-address 0.0.0.0 `
    --end-ip-address 0.0.0.0 `
    --output none

# ── 4. Storage Account ────────────────────────────────────────────────────────
Write-Host "[4/9] Creating Storage Account..." -ForegroundColor Yellow
az storage account create `
    --resource-group $ResourceGroup `
    --name $StorageAccountName `
    --location $Location `
    --sku Standard_LRS `
    --kind StorageV2 `
    --access-tier Hot `
    --output none

# Create blob container for uploads
az storage container create `
    --account-name $StorageAccountName `
    --name uploads `
    --public-access off `
    --auth-mode login `
    --output none

Write-Host "      [OK] Storage account: $StorageAccountName (container: uploads)" -ForegroundColor Green

# ── 5. App Service Plan ───────────────────────────────────────────────────────
Write-Host "[5/9] Creating App Service Plan (B1)..." -ForegroundColor Yellow
az appservice plan create `
    --resource-group $ResourceGroup `
    --name $AppServicePlan `
    --location $Location `
    --sku B1 `
    --is-linux `
    --output none

Write-Host "      [OK] App Service Plan: $AppServicePlan (B1 Linux)" -ForegroundColor Green

# ── 6. Web App ────────────────────────────────────────────────────────────────
Write-Host "[6/9] Creating Web App..." -ForegroundColor Yellow
az webapp create `
    --resource-group $ResourceGroup `
    --plan $AppServicePlan `
    --name $AppName `
    --runtime "NODE:22-lts" `
    --output none

# Enable Node.js startup
az webapp config set `
    --resource-group $ResourceGroup `
    --name $AppName `
    --startup-file "node server.js" `
    --output none

Write-Host "      [OK] Web App: https://$AppName.azurewebsites.net" -ForegroundColor Green

# ── 7. Azure Front Door (CDN) ─────────────────────────────────────────────────
Write-Host "[7/9] Creating Azure Front Door profile and endpoint..." -ForegroundColor Yellow
$StorageBlobHost = "$StorageAccountName.blob.core.windows.net"

az afd profile create `
    --resource-group $ResourceGroup `
    --profile-name $CdnProfileName `
    --sku Standard_AzureFrontDoor `
    --output none

az afd endpoint create `
    --resource-group $ResourceGroup `
    --profile-name $CdnProfileName `
    --endpoint-name $CdnEndpointName `
    --enabled-state Enabled `
    --output none

$CdnEndpointUrl = az afd endpoint show `
    --resource-group $ResourceGroup `
    --profile-name $CdnProfileName `
    --endpoint-name $CdnEndpointName `
    --query hostName --output tsv 2>$null

if ($CdnEndpointUrl) {
    $CdnEndpointUrl = "https://$CdnEndpointUrl"
    Write-Host "      [OK] Front Door endpoint: $CdnEndpointUrl" -ForegroundColor Green
} else {
    $CdnEndpointUrl = "https://$StorageBlobHost/uploads"
    Write-Host "      [OK] CDN skipped - using blob storage URL: $CdnEndpointUrl" -ForegroundColor Yellow
}

# ── 8. Retrieve connection strings ─────────────────────────────────────────────
Write-Host "[8/9] Retrieving connection strings..." -ForegroundColor Yellow

$DbHost = "$DbServerName.postgres.database.azure.com"
$DatabaseUrl = "postgresql://${DbAdminUser}:${DbAdminPass}@${DbHost}:5432/${DbName}?sslmode=require"
$AppUrl = "https://$AppName.azurewebsites.net"

$StorageConnStr = az storage account show-connection-string `
    --resource-group $ResourceGroup `
    --name $StorageAccountName `
    --query connectionString `
    --output tsv

# ── 9. Auto-configure App Service environment variables ────────────────────────
Write-Host "[9/9] Configuring App Service environment variables..." -ForegroundColor Yellow

# Note: AUTH_SECRET must be provided — generate with: openssl rand -base64 32
$AuthSecret = Read-Host "Enter AUTH_SECRET (or press Enter to skip and set manually later)"

$settings = @(
    "DATABASE_URL=$DatabaseUrl",
    "AZURE_STORAGE_CONNECTION_STRING=$StorageConnStr",
    "NEXT_PUBLIC_API_URL=$AppUrl",
    "NEXT_PUBLIC_CDN_URL=$CdnEndpointUrl",
    "AUTH_TRUST_HOST=true",
    "NODE_ENV=production",
    "WEBSITE_NODE_DEFAULT_VERSION=~20"
)
if ($AuthSecret) { $settings += "AUTH_SECRET=$AuthSecret" }

az webapp config appsettings set `
    --resource-group $ResourceGroup `
    --name $AppName `
    --settings @settings `
    --output none

Write-Host "      [OK] App Service settings configured" -ForegroundColor Green

# ── Output summary ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [DONE] Provisioning Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Your app URL: $AppUrl" -ForegroundColor Cyan
Write-Host "CDN endpoint: $CdnEndpointUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "--- Add these to GitHub Secrets for the deploy workflow ---" -ForegroundColor Yellow
Write-Host "AZURE_WEBAPP_NAME=$AppName"
Write-Host "AZURE_WEBAPP_PUBLISH_PROFILE=<download from App Service portal, Get publish profile>"
Write-Host "DATABASE_URL=$DatabaseUrl"
Write-Host "NEXT_PUBLIC_CDN_URL=$CdnEndpointUrl"
if (-not $AuthSecret) {
    Write-Host ""
    Write-Host "--- Still needed in App Service settings (not set above) ---" -ForegroundColor Yellow
    Write-Host "AUTH_SECRET=<run: openssl rand -base64 32>"
}
Write-Host ""
Write-Host "--- Entra External ID (B2C) --- MUST be re-registered in the new tenant ---" -ForegroundColor Yellow
Write-Output @"
1. In the new tenant Azure portal:
   Entra ID, App registrations, New registration
   Add redirect URI: $AppUrl/api/auth/callback/azure-ad-b2c
2. Create a B2C user flow named: B2C_1_signup_signin
3. Set these GitHub Secrets (and App Service settings):
   NEXT_PUBLIC_AZURE_B2C_TENANT_NAME=<new-tenant-name>
   NEXT_PUBLIC_AZURE_B2C_CLIENT_ID=<new-app-client-id>
   NEXT_PUBLIC_AZURE_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_signup_signin
"@
Write-Host ""
Write-Host "--- Optional OAuth providers (add via App Service settings) ---" -ForegroundColor Yellow
Write-Output @"
AUTH_GOOGLE_ID=<from Google Cloud Console>
AUTH_GOOGLE_SECRET=<from Google Cloud Console>
AUTH_FACEBOOK_ID=<from Facebook Developer Console>
AUTH_FACEBOOK_SECRET=<from Facebook Developer Console>
"@
Write-Host ""
Write-Host "--- Next steps ---" -ForegroundColor Cyan
Write-Output @"
1. Run the database migration against production:
   Set-Item -Path Env:DATABASE_URL -Value '$DatabaseUrl'
   pnpm exec prisma migrate deploy

2. Download publish profile and add to GitHub Secret AZURE_WEBAPP_PUBLISH_PROFILE:
   https://portal.azure.com  ->  $AppName  ->  Get publish profile

3. Push to main branch - deploy.yml will automatically deploy to App Service.
"@
