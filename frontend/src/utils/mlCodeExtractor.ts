import type { IObservation } from '../types/api';

/**
 * Extract ML codes from observations using decision tree logic (AND/OR rules)
 */
export const extractMLCodes = (obsList: IObservation[]): string[] => {
  const codes = new Set<string>();
  
  const hasObs = (attr: string, obj: string, val: string) =>
    obsList.some((o) => o.attribute === attr && o.object === obj && o.value === val);

  // 1. COMPLEX RULES (AND/OR)
  if (hasObs('Atmosphere', 'Ambient Sound', 'Rumbling') && hasObs('Seismic', 'Ground Sensation', 'Felt Earthquake')) {
    codes.add('Ts-2');
  }
  
  if (hasObs('Seagull', 'Seagull Movement', 'Hasty Flying') && hasObs('Seagull', 'Seagull Sound', 'Loud Calling')) {
    codes.add('Wn-6');
  }
  
  if (
    (hasObs('Atmosphere', 'Precipitation', 'Rain') || hasObs('Cloud', 'Cloud Density', 'Thick Clouds')) &&
    hasObs('Atmosphere', 'Wind/Monsoon Season', 'East Wind (Monsoon)')
  ) {
    codes.add('Wn-9');
  }
  
  if (hasObs('Atmosphere', 'Weather Condition', 'Clear/No Clouds') && hasObs('Atmosphere', 'Wind/Monsoon Season', 'West Wind (Monsoon)')) {
    codes.add('Wn-10'); // Or Wv-1
  }
  
  if (hasObs('Star', 'Star Condition', 'Many/Twinkling') && hasObs('Atmosphere', 'Wind/Monsoon Season', 'West Wind (Monsoon)')) {
    codes.add('Wn-12');
  }
  
  if (hasObs('Star', 'Star Condition', 'Not Visible') && hasObs('Atmosphere', 'Wind/Monsoon Season', 'East Wind (Monsoon)')) {
    codes.add('Wn-13');
  }
  
  if (
    hasObs('Star', 'Star Position', 'Approaching/Aligning with Moon') ||
    hasObs('Star', 'Star Position', "Entering Moon's Halo")
  ) {
    codes.add('Wn-14');
  }
  
  if (hasObs('Star', 'Star Cluster', 'Pleiades (Seven Stars) Observed')) {
    codes.add('Wn-16');
  }
  
  if (
    hasObs('Lightning', 'Lightning Activity', 'Single-Sided') ||
    hasObs('Lightning', 'Lightning Activity', 'Two-Sided (Back and Forth)')
  ) {
    codes.add('Wn-3');
  }

  // 2. SIMPLE RULES
  obsList.forEach((o) => {
    if (o.attribute === 'Cloud' && o.object === 'Cloud Pattern' && o.value === 'Descending Clusters') {
      codes.add('Wn-1');
    }
    if (o.attribute === 'Cloud' && o.object === 'Cloud Pattern' && o.value === 'Merging Clusters') {
      codes.add('Wn-2');
    }
    if (o.attribute === 'Sea' && o.object === 'Wave Pattern' && o.value === 'Small and Frequent (to) Large and Close') {
      codes.add('Wn-4');
    }
    if (o.attribute === 'Dolphin' && o.object === 'Dolphin Activity' && o.value === 'Approaching/Guiding Boat') {
      codes.add('Wn-5');
    }
    if (o.attribute === 'Animal Behavior' && o.object === 'Cockroach Activity' && o.value === 'Flying Inside Boat') {
      codes.add('Wn-15');
    }
    if (o.attribute === 'Whale' && o.object === 'Whale Activity' && o.value === 'Surfaces and Tail Flicking') {
      codes.add('Wn-17');
    }
    if (o.attribute === 'Sea' && o.object === 'Tidal Movement' && o.value === 'Calm (no high or low tide)') {
      codes.add('Ts-1');
    }
    if (o.attribute === 'Sea' && o.object === 'Water Level' && o.value === 'Sudden Recession') {
      codes.add('Ts-3');
    }
    if (o.attribute === 'Sea' && o.object === 'Wave Condition' && o.value === 'Very Large') {
      codes.add('Ts-4');
    }
    if (o.attribute === 'Pets' && o.object === 'Pets' && o.value === 'Distressed') {
      codes.add('Ts-6');
    }
    if (o.attribute === 'Sea' && o.object === 'Surface Debris' && o.value === 'A Lot of Trash or Wood') {
      codes.add('Cr-1');
    }
    if (o.attribute === 'Sea' && o.object === 'Water Clarity' && o.value === 'Murky/Turbid') {
      codes.add('Cr-2');
    }
    if (o.attribute === 'Sea' && o.object === 'Surface Pattern' && o.value === 'Rippling/Arc Formation') {
      codes.add('Cr-3');
    }
    if (o.attribute === 'Star' && o.object === 'Pleiades (Seven Stars)' && o.value === 'Immersed/Not Visible') {
      codes.add('Cr-4');
    }
    if (o.attribute === 'Moon' && o.object === 'Moon Phase' && o.value === 'Full Moon') {
      codes.add('Td-1');
    }
  });

  return Array.from(codes);
};
