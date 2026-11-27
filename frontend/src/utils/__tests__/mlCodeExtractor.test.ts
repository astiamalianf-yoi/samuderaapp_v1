import { describe, it, expect } from 'vitest'
import { extractMLCodes } from '../mlCodeExtractor'
import type { IObservation } from '../../types/api'

const obs = (attribute: string, object: string, value: string): IObservation => ({
  attribute,
  object,
  value,
  label: `${attribute} - ${object} - ${value}`,
})

describe('extractMLCodes', () => {
  it('returns empty array for empty observations list', () => {
    expect(extractMLCodes([])).toEqual([])
  })

  // ── Complex AND rules ──────────────────────────────────────────────────────

  it('extracts Ts-2 when Rumbling AND Felt Earthquake are present', () => {
    const codes = extractMLCodes([
      obs('Atmosphere', 'Ambient Sound', 'Rumbling'),
      obs('Seismic', 'Ground Sensation', 'Felt Earthquake'),
    ])
    expect(codes).toContain('Ts-2')
  })

  it('does NOT extract Ts-2 when only Rumbling is present', () => {
    const codes = extractMLCodes([obs('Atmosphere', 'Ambient Sound', 'Rumbling')])
    expect(codes).not.toContain('Ts-2')
  })

  it('extracts Wn-6 when Hasty Flying AND Loud Calling are present', () => {
    const codes = extractMLCodes([
      obs('Seagull', 'Seagull Movement', 'Hasty Flying'),
      obs('Seagull', 'Seagull Sound', 'Loud Calling'),
    ])
    expect(codes).toContain('Wn-6')
  })

  it('does NOT extract Wn-6 when only Hasty Flying is present', () => {
    const codes = extractMLCodes([obs('Seagull', 'Seagull Movement', 'Hasty Flying')])
    expect(codes).not.toContain('Wn-6')
  })

  // ── Complex OR + AND rules ─────────────────────────────────────────────────

  it('extracts Wn-9 when Rain AND East Wind are present', () => {
    const codes = extractMLCodes([
      obs('Atmosphere', 'Precipitation', 'Rain'),
      obs('Atmosphere', 'Wind/Monsoon Season', 'East Wind (Monsoon)'),
    ])
    expect(codes).toContain('Wn-9')
  })

  it('extracts Wn-9 when Thick Clouds AND East Wind are present', () => {
    const codes = extractMLCodes([
      obs('Cloud', 'Cloud Density', 'Thick Clouds'),
      obs('Atmosphere', 'Wind/Monsoon Season', 'East Wind (Monsoon)'),
    ])
    expect(codes).toContain('Wn-9')
  })

  it('does NOT extract Wn-9 when only Rain is present (missing East Wind)', () => {
    const codes = extractMLCodes([obs('Atmosphere', 'Precipitation', 'Rain')])
    expect(codes).not.toContain('Wn-9')
  })

  it('extracts Wn-10 when Clear weather AND West Wind are present', () => {
    const codes = extractMLCodes([
      obs('Atmosphere', 'Weather Condition', 'Clear/No Clouds'),
      obs('Atmosphere', 'Wind/Monsoon Season', 'West Wind (Monsoon)'),
    ])
    expect(codes).toContain('Wn-10')
  })

  it('extracts Wn-12 when Many Stars AND West Wind are present', () => {
    const codes = extractMLCodes([
      obs('Star', 'Star Condition', 'Many/Twinkling'),
      obs('Atmosphere', 'Wind/Monsoon Season', 'West Wind (Monsoon)'),
    ])
    expect(codes).toContain('Wn-12')
  })

  it('extracts Wn-13 when Stars Not Visible AND East Wind are present', () => {
    const codes = extractMLCodes([
      obs('Star', 'Star Condition', 'Not Visible'),
      obs('Atmosphere', 'Wind/Monsoon Season', 'East Wind (Monsoon)'),
    ])
    expect(codes).toContain('Wn-13')
  })

  // ── Complex OR rules (single condition) ───────────────────────────────────

  it('extracts Wn-14 when star is Approaching Moon', () => {
    const codes = extractMLCodes([
      obs('Star', 'Star Position', 'Approaching/Aligning with Moon'),
    ])
    expect(codes).toContain('Wn-14')
  })

  it('extracts Wn-14 when star is Entering Moon Halo', () => {
    const codes = extractMLCodes([
      obs('Star', 'Star Position', "Entering Moon's Halo"),
    ])
    expect(codes).toContain('Wn-14')
  })

  it('extracts Wn-3 when Single-Sided lightning present', () => {
    const codes = extractMLCodes([
      obs('Lightning', 'Lightning Activity', 'Single-Sided'),
    ])
    expect(codes).toContain('Wn-3')
  })

  it('extracts Wn-3 when Two-Sided lightning present', () => {
    const codes = extractMLCodes([
      obs('Lightning', 'Lightning Activity', 'Two-Sided (Back and Forth)'),
    ])
    expect(codes).toContain('Wn-3')
  })

  // ── Simple rules ───────────────────────────────────────────────────────────

  it('extracts Wn-1 for Descending Cloud Clusters', () => {
    const codes = extractMLCodes([obs('Cloud', 'Cloud Pattern', 'Descending Clusters')])
    expect(codes).toContain('Wn-1')
  })

  it('extracts Wn-2 for Merging Cloud Clusters', () => {
    const codes = extractMLCodes([obs('Cloud', 'Cloud Pattern', 'Merging Clusters')])
    expect(codes).toContain('Wn-2')
  })

  it('extracts Wn-4 for wave pattern change', () => {
    const codes = extractMLCodes([obs('Sea', 'Wave Pattern', 'Small and Frequent (to) Large and Close')])
    expect(codes).toContain('Wn-4')
  })

  it('extracts Wn-5 for dolphin guiding boat', () => {
    const codes = extractMLCodes([obs('Dolphin', 'Dolphin Activity', 'Approaching/Guiding Boat')])
    expect(codes).toContain('Wn-5')
  })

  it('extracts Wn-15 for flying cockroach', () => {
    const codes = extractMLCodes([obs('Animal Behavior', 'Cockroach Activity', 'Flying Inside Boat')])
    expect(codes).toContain('Wn-15')
  })

  it('extracts Wn-17 for whale tail flicking', () => {
    const codes = extractMLCodes([obs('Whale', 'Whale Activity', 'Surfaces and Tail Flicking')])
    expect(codes).toContain('Wn-17')
  })

  it('extracts Ts-1 for calm tidal movement', () => {
    const codes = extractMLCodes([obs('Sea', 'Tidal Movement', 'Calm (no high or low tide)')])
    expect(codes).toContain('Ts-1')
  })

  it('extracts Ts-3 for sudden water recession', () => {
    const codes = extractMLCodes([obs('Sea', 'Water Level', 'Sudden Recession')])
    expect(codes).toContain('Ts-3')
  })

  it('extracts Ts-4 for very large waves', () => {
    const codes = extractMLCodes([obs('Sea', 'Wave Condition', 'Very Large')])
    expect(codes).toContain('Ts-4')
  })

  it('extracts Ts-6 for distressed pets', () => {
    const codes = extractMLCodes([obs('Pets', 'Pets', 'Distressed')])
    expect(codes).toContain('Ts-6')
  })

  it('extracts Cr-1 for surface debris', () => {
    const codes = extractMLCodes([obs('Sea', 'Surface Debris', 'A Lot of Trash or Wood')])
    expect(codes).toContain('Cr-1')
  })

  it('extracts Cr-2 for murky water', () => {
    const codes = extractMLCodes([obs('Sea', 'Water Clarity', 'Murky/Turbid')])
    expect(codes).toContain('Cr-2')
  })

  it('extracts Cr-3 for arc/ripple formation', () => {
    const codes = extractMLCodes([obs('Sea', 'Surface Pattern', 'Rippling/Arc Formation')])
    expect(codes).toContain('Cr-3')
  })

  it('extracts Cr-4 for invisible Pleiades', () => {
    const codes = extractMLCodes([obs('Star', 'Pleiades (Seven Stars)', 'Immersed/Not Visible')])
    expect(codes).toContain('Cr-4')
  })

  it('extracts Td-1 for full moon', () => {
    const codes = extractMLCodes([obs('Moon', 'Moon Phase', 'Full Moon')])
    expect(codes).toContain('Td-1')
  })

  // ── Multiple rules in one call ─────────────────────────────────────────────

  it('extracts multiple codes when multiple triggers are present', () => {
    const codes = extractMLCodes([
      obs('Cloud', 'Cloud Pattern', 'Descending Clusters'),  // Wn-1
      obs('Sea', 'Water Level', 'Sudden Recession'),         // Ts-3
      obs('Moon', 'Moon Phase', 'Full Moon'),                // Td-1
    ])
    expect(codes).toContain('Wn-1')
    expect(codes).toContain('Ts-3')
    expect(codes).toContain('Td-1')
  })

  it('does not duplicate codes when the same trigger appears multiple times', () => {
    const codes = extractMLCodes([
      obs('Cloud', 'Cloud Pattern', 'Descending Clusters'),
      obs('Cloud', 'Cloud Pattern', 'Descending Clusters'),
    ])
    const wn1Count = codes.filter(c => c === 'Wn-1').length
    expect(wn1Count).toBe(1)
  })
})
