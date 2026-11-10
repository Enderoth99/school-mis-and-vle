param(
 [string]$ProjectId = 'economics-monopoly',
 [string]$Region = 'europe-west1',
 [string]$SourceDirectory,
 [string]$Origin = 'https://enderoth-learning-hub.web.app'
)
$ErrorActionPreference = 'Stop'
if ($ProjectId -notmatch '^[a-z][a-z0-9-]+$' -or $Region -notmatch '^[a-z]+-[a-z]+[0-9]$') { throw 'Invalid project or region.' }
function Invoke-Gcloud {
 param([string[]]$Arguments)
 & gcloud @Arguments
 if ($LASTEXITCODE -ne 0) { throw 'Google Cloud command failed. Deployment stopped.' }
}
$billing = & gcloud billing projects describe $ProjectId --format=json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $billing.billingEnabled) { throw "Billing is not enabled for $ProjectId. No infrastructure changes were made." }
if (-not $SourceDirectory) { throw 'Supply the prepared server build directory.' }
$source = (Resolve-Path -LiteralPath $SourceDirectory).Path
if (-not (Test-Path -LiteralPath (Join-Path $source 'Dockerfile')) -or -not (Test-Path -LiteralPath (Join-Path $source 'deploy\seed\directory.json'))) { throw 'Use a complete shared-server build.' }
Invoke-Gcloud -Arguments @('services','enable','run.googleapis.com','cloudbuild.googleapis.com','artifactregistry.googleapis.com','storage.googleapis.com',"--project=$ProjectId",'--quiet')
$runtime = "school-mis-runtime@$ProjectId.iam.gserviceaccount.com"
$builder = "school-mis-build@$ProjectId.iam.gserviceaccount.com"
$accounts = & gcloud iam service-accounts list "--project=$ProjectId" --format=json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect deployment identities.' }
foreach ($item in @(@{Id='school-mis-runtime';Name='School MIS runtime';Email=$runtime},@{Id='school-mis-build';Name='School MIS image build';Email=$builder})) {
 if ($accounts.email -notcontains $item.Email) { Invoke-Gcloud -Arguments @('iam','service-accounts','create',$item.Id,"--display-name=$($item.Name)","--project=$ProjectId",'--quiet') }
}
Invoke-Gcloud -Arguments @('projects','add-iam-policy-binding',$ProjectId,"--member=serviceAccount:$builder",'--role=roles/run.builder','--condition=None','--quiet')
$bucket = "$ProjectId-school-mis-private"
$buckets = & gcloud storage buckets list "--project=$ProjectId" --format=json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect private storage.' }
if ($buckets.name -notcontains $bucket -and $buckets.name -notcontains "gs://$bucket") {
 Invoke-Gcloud -Arguments @('storage','buckets','create',"gs://$bucket","--project=$ProjectId","--location=$Region",'--uniform-bucket-level-access','--public-access-prevention','--quiet')
}
Invoke-Gcloud -Arguments @('storage','buckets','update',"gs://$bucket",'--versioning','--public-access-prevention','--uniform-bucket-level-access','--quiet')
Invoke-Gcloud -Arguments @('storage','buckets','add-iam-policy-binding',"gs://$bucket","--member=serviceAccount:$runtime",'--role=roles/storage.objectUser','--quiet')
$variables = "WIST_STORAGE_BUCKET=$bucket,WIST_PUBLIC_ORIGIN=$Origin,WIST_BASE_PATH=/wist-mis-testing,WIST_SESSION_COOKIE=__session,WIST_SEED_DIR=/app/deploy/seed"
Invoke-Gcloud -Arguments @('run','deploy','school-mis-vle',"--source=$source","--project=$ProjectId","--region=$Region","--service-account=$runtime","--build-service-account=projects/$ProjectId/serviceAccounts/$builder",'--allow-unauthenticated','--max-instances=1','--min-instances=0','--concurrency=40','--memory=512Mi','--cpu=1','--timeout=60',"--set-env-vars=$variables",'--quiet')
Write-Output 'Shared backend deployed. Verify it directly before changing Learning Hub routing.'
