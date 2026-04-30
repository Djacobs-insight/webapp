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
#   - Outputs all connection strings and env vars needed
# =============================================================================

param(
    [string]$AppName       = "fivekapp",          # Must be globally unique → becomes <AppName>.azurewebsites.net
    [string]$ResourceGroup = "fivekapp-rg",
    [string]$Location      = "australiaeast",     # Change to your preferred region
    [string]$DbAdminUser   = "fivekadmin",
    [string]$DbAdminPass   = "",                  # Leave blank to be prompted securely
    [string]$DbName        = "iteration1"
)

# ── Validate Azure CLI ─────────────────────────────────────────────────────────
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Azure CLI not found. Install from: https://aka.ms/installazurecliwindows"
    exit 1
}

# Check login
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Not logged in. Running az login..." -ForegroundColor Yellow
    az login
    $account = az account show | ConvertFrom-Json
}
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

Write-Host "`n=== Provisioning Azure Resources ===" -ForegroundColor Green
Write-Host "App Name:       $AppName"
Write-Host "Resource Group: $ResourceGroup"
Write-Host "Location:       $Location"
Write-Host "DB Server:      $DbServerName"
Write-Host "Storage:        $StorageAccountName"
Write-Host ""

# ── 1. Resource Group ──────────────────────────────────────────────────────────
Write-Host "[1/7] Creating resource group..." -ForegroundColor Yellow
az group create `
    --name $ResourceGroup `
    --location $Location `
    --output none

Write-Host "      ✓ Resource group: $ResourceGroup" -ForegroundColor Green

# ── 2. PostgreSQL Flexible Server ─────────────────────────────────────────────
Write-Host "[2/7] Creating PostgreSQL Flexible Server (this takes ~5 mins)..." -ForegroundColor Yellow
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

Write-Host "      ✓ PostgreSQL server: $DbServerName" -ForegroundColor Green

# ── 3. Create database ─────────────────────────────────────────────────────────
Write-Host "[3/7] Creating database '$DbName'..." -ForegroundColor Yellow
az postgres flexible-server db create `
    --resource-group $ResourceGroup `
    --server-name $DbServerName `
    --database-name $DbName `
    --output none

Write-Host "      ✓ Database: $DbName" -ForegroundColor Green

# Allow Azure services to connect to the DB
az postgres flexible-server firewall-rule create `
    --resource-group $ResourceGroup `
    --name $DbServerName `
    --rule-name AllowAzureServices `
    --start-ip-address 0.0.0.0 `
    --end-ip-address 0.0.0.0 `
    --output none

# ── 4. Storage Account ────────────────────────────────────────────────────────
Write-Host "[4/7] Creating Storage Account..." -ForegroundColor Yellow
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

Write-Host "      ✓ Storage account: $StorageAccountName (container: uploads)" -ForegroundColor Green

# ── 5. App Service Plan ───────────────────────────────────────────────────────
Write-Host "[5/7] Creating App Service Plan (B1)..." -ForegroundColor Yellow
az appservice plan create `
    --resource-group $ResourceGroup `
    --name $AppServicePlan `
    --location $Location `
    --sku B1 `
    --is-linux `
    --output none

Write-Host "      ✓ App Service Plan: $AppServicePlan (B1 Linux)" -ForegroundColor Green

# ── 6. Web App ────────────────────────────────────────────────────────────────
Write-Host "[6/7] Creating Web App..." -ForegroundColor Yellow
az webapp create `
    --resource-group $ResourceGroup `
    --plan $AppServicePlan `
    --name $AppName `
    --runtime "NODE:20-lts" `
    --output none

# Enable Node.js startup
az webapp config set `
    --resource-group $ResourceGroup `
    --name $AppName `
    --startup-file "node server.js" `
    --output none

Write-Host "      ✓ Web App: https://$AppName.azurewebsites.net" -ForegroundColor Green

# ── 7. Retrieve connection strings ────────────────────────────────────────────
Write-Host "[7/7] Retrieving connection strings..." -ForegroundColor Yellow

$DbHost = "$DbServerName.postgres.database.azure.com"
$DatabaseUrl = "postgresql://${DbAdminUser}:${DbAdminPass}@${DbHost}:5432/${DbName}?sslmode=require"

$StorageConnStr = az storage account show-connection-string `
    --resource-group $ResourceGroup `
    --name $StorageAccountName `
    --query connectionString `
    --output tsv

# ── Output summary ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== ✅ Provisioning Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Your app URL: https://$AppName.azurewebsites.net" -ForegroundColor Cyan
Write-Host ""
Write-Host "--- Copy these into GitHub Secrets AND App Service Configuration ---" -ForegroundColor Yellow
Write-Host ""
Write-Host "DATABASE_URL=$DatabaseUrl"
Write-Host "AZURE_STORAGE_CONNECTION_STRING=$StorageConnStr"
Write-Host "STORAGE_PROVIDER=azure"
Write-Host "AUTH_TRUST_HOST=true"
Write-Host "NODE_ENV=production"
Write-Host ""
Write-Host "--- Still needed (add manually) ---" -ForegroundColor Yellow
Write-Host "AUTH_SECRET=<run: openssl rand -base64 32>"
Write-Host "AUTH_GOOGLE_ID=<from Google Cloud Console>"
Write-Host "AUTH_GOOGLE_SECRET=<from Google Cloud Console>"
Write-Host "AZURE_WEBAPP_NAME=$AppName"
Write-Host "AZURE_WEBAPP_PUBLISH_PROFILE=<download from App Service portal → Get publish profile>"
Write-Host ""
Write-Host "--- Next steps ---" -ForegroundColor Cyan
Write-Host "1. Copy the DATABASE_URL above and run the migration:"
Write-Host "   `$env:DATABASE_URL='$DatabaseUrl'"
Write-Host "   pnpm exec prisma migrate deploy"
Write-Host ""
Write-Host "2. Set all env vars in App Service:"
Write-Host "   az webapp config appsettings set --resource-group $ResourceGroup --name $AppName --settings DATABASE_URL='...' AUTH_SECRET='...'"
Write-Host ""
Write-Host "3. Download publish profile and add to GitHub Secrets:"
Write-Host "   https://portal.azure.com → $AppName → Get publish profile"
Write-Host ""
Write-Host "4. Create .github/workflows/deploy.yml (ask Copilot to generate it)"
