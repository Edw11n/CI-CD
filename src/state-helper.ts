import * as core from '@actions/core';

import {Build} from '@docker/actions-toolkit/lib/buildx/build.js';

import {Inputs} from './context.js';

/**
 * [PROBLEMA 4] ANTIPATRÓN E INCOMPATIBILIDAD EN GESTIÓN DE ESTADO CON PROCESS.ENV Y JSON.PARSE
 * Problema anterior: Lectura estática y directa de `process.env['STATE_*']` en tiempo
 * de importación del módulo y `JSON.parse` sin bloque try/catch. Esto violaba la
 * encapsulación de la API de GitHub Actions (`core.getState`) y provocaba fallos no
 * controlados si el JSON del estado estaba dañado o vacío.
 * Solución implementada: Lectura dinámica utilizando `core.getState(...)` con fallback a
 * `process.env` y parseo seguro con try/catch en `summaryInputs`.
 */
export function getTmpDir(): string {
  return core.getState('tmpDir') || process.env['STATE_tmpDir'] || '';
}

export function getBuilderDriver(): string {
  return core.getState('builderDriver') || process.env['STATE_builderDriver'] || '';
}

export function getBuilderEndpoint(): string {
  return core.getState('builderEndpoint') || process.env['STATE_builderEndpoint'] || '';
}

export function getSummaryInputs(): Record<string, unknown> | undefined {
  const raw = core.getState('summaryInputs') || process.env['STATE_summaryInputs'];
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    core.warning('No se pudo parsear el estado guardado summaryInputs');
    return undefined;
  }
}

export function getBuildRef(): string {
  return core.getState('buildRef') || process.env['STATE_buildRef'] || '';
}

export function isSummarySupported(): boolean {
  return Boolean(core.getState('isSummarySupported') || process.env['STATE_isSummarySupported']);
}

// Variables mantenidas para retrocompatibilidad con código que lea las propiedades directamente
export const tmpDir = getTmpDir();
export const builderDriver = getBuilderDriver();
export const builderEndpoint = getBuilderEndpoint();
export const summaryInputs = getSummaryInputs();
export const buildRef = getBuildRef();

export function setTmpDir(tmpDir: string) {
  core.saveState('tmpDir', tmpDir);
}

export function setBuilderDriver(builderDriver: string) {
  core.saveState('builderDriver', builderDriver);
}

export function setBuilderEndpoint(builderEndpoint: string) {
  core.saveState('builderEndpoint', builderEndpoint);
}

export function setBuildRef(buildRef: string) {
  core.saveState('buildRef', buildRef);
}

export function setSummarySupported() {
  core.saveState('isSummarySupported', 'true');
}

export function setSummaryInputs(inputs: Inputs) {
  // Corrección: tipado explícito para evitar problemas de indexación de objetos en TS
  const res: Record<string, unknown> = {};
  for (const key of Object.keys(inputs)) {
    if (key === 'github-token') {
      continue;
    }
    const value: string | string[] | boolean = inputs[key];
    if (typeof value === 'boolean' && !value) {
      continue;
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      } else if (key === 'secrets' && value.length > 0) {
        const secretKeys: string[] = [];
        for (const secret of value) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [skey, _] = Build.parseSecretKvp(secret, true);
            secretKeys.push(skey);
          } catch {
            // ignore invalid secret
          }
        }
        if (secretKeys.length > 0) {
          res[key] = secretKeys;
        }
        continue;
      }
    } else if (!value) {
      continue;
    }
    res[key] = value;
  }
  core.saveState('summaryInputs', JSON.stringify(res));
}
