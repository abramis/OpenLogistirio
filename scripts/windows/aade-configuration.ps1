Set-StrictMode -Version 2.0

function Test-OpenLogistirioYesAnswer {
  param(
    [AllowEmptyString()]
    [string]$Answer,
    [bool]$Default = $true
  )

  if ([string]::IsNullOrWhiteSpace($Answer)) {
    return $Default
  }

  $normalized = $Answer.Trim().ToLowerInvariant()
  return $normalized -in @("y", "yes", "n", "nai", "ν", "ναι")
}

function Read-OpenLogistirioHiddenValue {
  param([Parameter(Mandatory = $true)][string]$Prompt)

  $secureValue = Read-Host -Prompt $Prompt -AsSecureString
  $pointer = [IntPtr]::Zero
  try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    if ($pointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
  }
}

function Assert-OpenLogistirioAadeValue {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [AllowEmptyString()]
    [string]$Value
  )

  if ($Value -match "[`r`n`0]") {
    throw "Η τιμή $Name περιέχει μη επιτρεπτούς χαρακτήρες."
  }
}

function Set-OpenLogistirioAadeValues {
  param(
    [Parameter(Mandatory = $true)][string]$EnvironmentFile,
    [Parameter(Mandatory = $true)][hashtable]$Values
  )

  foreach ($entry in $Values.GetEnumerator()) {
    Assert-OpenLogistirioAadeValue -Name ([string]$entry.Key) -Value ([string]$entry.Value)
    Set-OpenLogistirioEnvironmentValue `
      -Path $EnvironmentFile `
      -Name ([string]$entry.Key) `
      -Value ([string]$entry.Value)
  }
}

function Import-OpenLogistirioAadeConfiguration {
  param(
    [Parameter(Mandatory = $true)][string]$EnvironmentFile,
    [Parameter(Mandatory = $true)][string]$ImportFile,
    [switch]$EnableProductionWrites,
    [switch]$EnableScheduledSync
  )

  if (-not (Test-Path -LiteralPath $ImportFile -PathType Leaf)) {
    throw "Δεν βρέθηκε το αρχείο ρυθμίσεων ΑΑΔΕ: $ImportFile"
  }

  $source = Read-OpenLogistirioEnvironment -Path $ImportFile
  $values = @{}
  foreach ($name in @(
      "AADE_REGISTRY_USERNAME",
      "AADE_REGISTRY_PASSWORD",
      "AADE_REGISTRY_CALLED_BY_VAT",
      "AADE_REGISTRY_ENDPOINT",
      "AADE_MYDATA_USER_ID",
      "AADE_MYDATA_SUBSCRIPTION_KEY"
    )) {
    if ($source.ContainsKey($name) -and
        -not [string]::IsNullOrWhiteSpace([string]$source[$name])) {
      $values[$name] = [string]$source[$name]
    }
  }

  $hasRegistryUser = $values.ContainsKey("AADE_REGISTRY_USERNAME")
  $hasRegistryPassword = $values.ContainsKey("AADE_REGISTRY_PASSWORD")
  if ($hasRegistryUser -ne $hasRegistryPassword) {
    throw "Το αρχείο πρέπει να περιέχει μαζί AADE_REGISTRY_USERNAME και AADE_REGISTRY_PASSWORD."
  }

  $hasMyDataUser = $values.ContainsKey("AADE_MYDATA_USER_ID")
  $hasMyDataKey = $values.ContainsKey("AADE_MYDATA_SUBSCRIPTION_KEY")
  if ($hasMyDataUser -ne $hasMyDataKey) {
    throw "Το αρχείο πρέπει να περιέχει μαζί AADE_MYDATA_USER_ID και AADE_MYDATA_SUBSCRIPTION_KEY."
  }

  if (-not $hasRegistryUser -and -not $hasMyDataUser) {
    throw "Το αρχείο δεν περιέχει πλήρες ζεύγος credentials Μητρώου ή myDATA."
  }

  if ($hasMyDataUser) {
    $values["AADE_MYDATA_ENV"] = "production"
    $values["AADE_MYDATA_PRODUCTION_READ_ENABLED"] = "true"
    $values["AADE_MYDATA_PRODUCTION_ENABLED"] = $EnableProductionWrites.IsPresent.ToString().ToLowerInvariant()
    $values["MYDATA_SCHEDULED_SYNC_ENABLED"] = $EnableScheduledSync.IsPresent.ToString().ToLowerInvariant()
  }
  $values["AADE_CONFIGURATION_PROMPTED"] = "true"

  Set-OpenLogistirioAadeValues -EnvironmentFile $EnvironmentFile -Values $values
}

function Initialize-OpenLogistirioAadeConfiguration {
  param(
    [Parameter(Mandatory = $true)][string]$EnvironmentFile,
    [switch]$Force
  )

  $current = Read-OpenLogistirioEnvironment -Path $EnvironmentFile
  $registryReady =
    $current.ContainsKey("AADE_REGISTRY_USERNAME") -and
    $current.ContainsKey("AADE_REGISTRY_PASSWORD") -and
    -not [string]::IsNullOrWhiteSpace([string]$current["AADE_REGISTRY_USERNAME"]) -and
    -not [string]::IsNullOrWhiteSpace([string]$current["AADE_REGISTRY_PASSWORD"])
  $myDataReady =
    $current.ContainsKey("AADE_MYDATA_USER_ID") -and
    $current.ContainsKey("AADE_MYDATA_SUBSCRIPTION_KEY") -and
    -not [string]::IsNullOrWhiteSpace([string]$current["AADE_MYDATA_USER_ID"]) -and
    -not [string]::IsNullOrWhiteSpace([string]$current["AADE_MYDATA_SUBSCRIPTION_KEY"])

  if ($registryReady -and $myDataReady -and -not $Force) {
    return
  }
  if (-not $Force -and
      $current.ContainsKey("AADE_CONFIGURATION_PROMPTED") -and
      [string]$current["AADE_CONFIGURATION_PROMPTED"] -eq "true") {
    return
  }

  Write-OpenLogistirioStep "Σύνδεση με ΑΑΔΕ"
  Write-Host "Δεν ζητούνται κωδικοί TAXISnet. Χρειάζονται μόνο οι ειδικοί κωδικοί Μητρώου και myDATA API." -ForegroundColor Gray
  $configure = Read-Host "Ρύθμιση πραγματικής σύνδεσης ΑΑΔΕ τώρα; (Ναι/όχι, προεπιλογή: Ναι)"
  if (-not (Test-OpenLogistirioYesAnswer -Answer $configure -Default $true)) {
    Set-OpenLogistirioEnvironmentValue `
      -Path $EnvironmentFile `
      -Name "AADE_CONFIGURATION_PROMPTED" `
      -Value "true"
    Write-Host "Μπορείτε να τη ρυθμίσετε αργότερα με το CONFIGURE-AADE-WINDOWS.cmd." -ForegroundColor Yellow
    return
  }

  $values = @{}
  if (-not $registryReady -or $Force) {
    $registryUser = (Read-Host "Ειδικό όνομα χρήστη Μητρώου ΑΑΔΕ (Enter για παράλειψη)").Trim()
    if (-not [string]::IsNullOrWhiteSpace($registryUser)) {
      $registryPassword = Read-OpenLogistirioHiddenValue "Ειδικός κωδικός Μητρώου ΑΑΔΕ"
      if ([string]::IsNullOrWhiteSpace($registryPassword)) {
        throw "Ο κωδικός Μητρώου ΑΑΔΕ δεν μπορεί να είναι κενός."
      }
      $values["AADE_REGISTRY_USERNAME"] = $registryUser
      $values["AADE_REGISTRY_PASSWORD"] = $registryPassword
      $values["AADE_REGISTRY_CALLED_BY_VAT"] = (Read-Host "ΑΦΜ λογιστικού γραφείου που κάνει την κλήση (προαιρετικό)").Trim()
      $values["AADE_REGISTRY_ENDPOINT"] = "https://www1.gsis.gr/wsaade/RgWsPublic2/RgWsPublic2"
    }
  }

  if (-not $myDataReady -or $Force) {
    $myDataUser = (Read-Host "Όνομα χρήστη myDATA REST API (Enter για παράλειψη)").Trim()
    if (-not [string]::IsNullOrWhiteSpace($myDataUser)) {
      $subscriptionKey = Read-OpenLogistirioHiddenValue "Subscription key myDATA REST API"
      if ([string]::IsNullOrWhiteSpace($subscriptionKey)) {
        throw "Το subscription key του myDATA δεν μπορεί να είναι κενό."
      }
      $writeAnswer = Read-Host "Ενεργοποίηση πραγματικών αποστολών με επιβεβαίωση ανά ενέργεια; (Ναι/όχι, προεπιλογή: Ναι)"
      $syncAnswer = Read-Host "Ενεργοποίηση καθημερινού read-only συγχρονισμού στις 02:00; (Ναι/όχι, προεπιλογή: Ναι)"
      $values["AADE_MYDATA_USER_ID"] = $myDataUser
      $values["AADE_MYDATA_SUBSCRIPTION_KEY"] = $subscriptionKey
      $values["AADE_MYDATA_ENV"] = "production"
      $values["AADE_MYDATA_PRODUCTION_READ_ENABLED"] = "true"
      $values["AADE_MYDATA_PRODUCTION_ENABLED"] =
        (Test-OpenLogistirioYesAnswer -Answer $writeAnswer -Default $true).ToString().ToLowerInvariant()
      $values["MYDATA_SCHEDULED_SYNC_ENABLED"] =
        (Test-OpenLogistirioYesAnswer -Answer $syncAnswer -Default $true).ToString().ToLowerInvariant()
    }
  }

  $values["AADE_CONFIGURATION_PROMPTED"] = "true"
  Set-OpenLogistirioAadeValues -EnvironmentFile $EnvironmentFile -Values $values
  if ($values.Count -gt 1) {
    Write-OpenLogistirioSuccess "Η σύνδεση ΑΑΔΕ αποθηκεύτηκε μόνο για τον τρέχοντα λογαριασμό Windows."
  }
}
