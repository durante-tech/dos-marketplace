#!/usr/bin/env bun

/**
 * Smoke Test: Verify Apify via Studio gateway works end-to-end.
 *
 * Studio-only — mirrors the Gemini image gateway pattern
 * (~/.claude/skills/media/Lib/gemini-image-gateway.ts:72). Requires
 * STUDIO_API_URL + STUDIO_API_KEY (or STUDIO_ORG_API_KEY) in
 * ~/.claude/.gateway.env. Fails fast with a clear error otherwise.
 *
 * The probe: GET /api/v1/media/generations/{fake-uuid}. A 404 response
 * proves the gateway is reachable and auth is accepted without spending
 * any credits. 401 would indicate a broken key; network errors indicate
 * gateway unreachable.
 */

import { Apify, getApifyClient } from "@durante/scraping/Apify"

const FAKE_GENERATION_ID = '00000000-0000-0000-0000-000000000000'

async function main() {
  console.log('=== Apify Studio Gateway Smoke Test ===\n')

  console.log('Test 1: Loading env and constructing client...')
  let apify: Apify
  try {
    apify = await getApifyClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`❌ ${msg}`)
    console.error('   Set STUDIO_API_URL + STUDIO_API_KEY in ~/.claude/.gateway.env')
    console.error('   Run: durante configure\n')
    process.exit(1)
  }

  if (!apify.isStudioMode) {
    console.error('❌ Studio gateway not configured. Run: durante configure')
    console.error('   STUDIO_API_URL and STUDIO_API_KEY must be set in')
    console.error('   ~/.claude/.gateway.env\n')
    process.exit(1)
  }
  console.log('✅ Studio mode active\n')

  console.log('Test 2: Probing Studio gateway (GET fake generation)...')
  // studioClient:exempt — BYOK gateway routing (Studio-or-direct), not the silent-skip auth guard pattern. Migration to getStudioConfig() is a separate pass.
  const studioUrl = process.env.STUDIO_API_URL!.replace(/\/+$/, '')
  const studioKey = process.env.STUDIO_ORG_API_KEY ?? process.env.STUDIO_API_KEY!

  const res = await fetch(`${studioUrl}/api/v1/media/generations/${FAKE_GENERATION_ID}`, {
    headers: {
      'Authorization': `Bearer ${studioKey}`,
      'Accept': 'application/json',
    },
  })

  if (res.status === 401 || res.status === 403) {
    console.error(`❌ Auth rejected (${res.status}) — STUDIO_API_KEY invalid`)
    process.exit(1)
  }
  if (res.status !== 404) {
    const body = await res.text().catch(() => '')
    console.error(`❌ Unexpected status ${res.status}: ${body.slice(0, 200)}`)
    process.exit(1)
  }
  console.log('✅ Gateway reachable, auth accepted (404 as expected)\n')

  console.log('=== ALL TESTS PASSED ===\n')
  console.log('✅ Studio gateway is configured and responsive')
  console.log('✅ Apify actor calls will route through the metered gateway\n')
}

if (import.meta.main) {
  main().catch((e) => {
    console.error('❌ Unhandled error:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
}

export { main }
