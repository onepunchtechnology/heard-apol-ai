import { getVercelOidcToken } from '@vercel/oidc'
import { ExternalAccountClient } from 'google-auth-library'

const GCP_PROJECT_ID = 'heard-apol-ai'
const GCP_REGION = 'us-central1'
const GCP_JOB_NAME = 'heard-agent'
const WIF_POOL_ID = 'vercel-pool'
const WIF_PROVIDER_ID = 'vercel-provider'
const SA_EMAIL = 'heard-vercel-trigger@heard-apol-ai.iam.gserviceaccount.com'

interface TriggerOptions {
  mode: 'sweep' | 'single'
  storeId: string
  reviewId?: string
}

export async function triggerCloudRunJob({ mode, storeId, reviewId }: TriggerOptions): Promise<void> {
  const projectNumber = process.env.GCP_PROJECT_NUMBER
  if (!projectNumber) throw new Error('GCP_PROJECT_NUMBER not configured')

  const authClient = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${WIF_POOL_ID}/providers/${WIF_PROVIDER_ID}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SA_EMAIL}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken(),
    },
  })

  if (!authClient) throw new Error('Failed to create auth client')
  authClient.scopes = ['https://www.googleapis.com/auth/cloud-platform']

  const { token } = await authClient.getAccessToken()
  if (!token) throw new Error('Failed to obtain GCP access token')

  const envVars: { name: string; value: string }[] = [
    { name: 'MODE', value: mode },
    { name: 'STORE_ID', value: storeId },
  ]
  if (reviewId) envVars.push({ name: 'REVIEW_ID', value: reviewId })

  const url = `https://run.googleapis.com/v2/projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}/jobs/${GCP_JOB_NAME}:run`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      overrides: { containerOverrides: [{ env: envVars }] },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Cloud Run Jobs API ${res.status}: ${text}`)
  }
}
