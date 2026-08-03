import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';

import { deviceParams, DeviceRefDto } from '../common/dto/device-ref.dto';
import { stringify } from '../common/utils/numeric';
import { ShineApiService } from '../shine/shine-api.service';
import type { ShineControlField, ShineParams } from '../shine/shine.types';
import type {
  ControlFieldDto,
  ControlInputType,
  ControlValueDto,
  ControlWriteResultDto,
  ProfileResultDto,
} from './dto/control.dto';
import { PREFERRED_PROFILE, PROFILE_STEP_DELAY_MS } from './preferred-profile';

/** Newer firmware exposes the web action; older devices only answer the legacy one. */
const FIELD_ACTIONS = ['webQueryDeviceCtrlField', 'queryDeviceCtrlField'];

/** How many times to poll a control value before giving up — the upstream is flaky here. */
const VALUE_READ_ATTEMPTS = 2;

/** Reuse field definitions briefly so writes and label lookup avoid re-fetching the full list. */
const FIELD_CACHE_TTL_MS = 5 * 60 * 1000;

interface FieldCacheEntry {
  expiresAt: number;
  fields: ControlFieldDto[];
}

@Injectable()
export class ControlsService {
  private readonly logger = new Logger(ControlsService.name);
  private readonly fieldCache = new Map<string, FieldCacheEntry>();

  constructor(private readonly shine: ShineApiService) {}

  async listFields(device: DeviceRefDto): Promise<ControlFieldDto[]> {
    const cached = this.cachedFields(device);
    if (cached) return cached;

    const result = await this.shine.callFirstSupported<{
      field?: ShineControlField[];
    }>(FIELD_ACTIONS, {
      ...deviceParams(device),
      i18n: this.shine.locale,
    });

    if (result.response.err !== 0) {
      throw new NotFoundException(
        result.response.desc ?? 'The inverter returned no control definition',
      );
    }

    const fields = (result.response.dat?.field ?? []).map((field) =>
      this.toFieldDto(field),
    );
    this.storeFields(device, fields);
    return fields;
  }

  /**
   * Reads one setting from the inverter. Matches the legacy dashboard, which
   * calls `queryDeviceCtrlValue` directly instead of prefetching the full field
   * list (that extra round-trip often exceeded the upstream timeout).
   */
  async readValue(
    device: DeviceRefDto,
    fieldId: string,
  ): Promise<ControlValueDto> {
    const field = this.cachedFields(device)?.find(
      (candidate) => candidate.id === fieldId,
    );

    for (let attempt = 0; attempt < VALUE_READ_ATTEMPTS; attempt += 1) {
      const result = await this.shine.call<unknown>('queryDeviceCtrlValue', {
        ...deviceParams(device),
        id: fieldId,
        i18n: this.shine.locale,
      });

      if (result.response.err === 0) {
        const raw = extractValue(result.response.dat);
        const value = raw === null ? null : normalizeOptionValue(field, raw);
        return {
          fieldId,
          value,
          label: value === null ? null : (resolveOptionLabel(field, value) ?? raw),
        };
      }

      if (attempt < VALUE_READ_ATTEMPTS - 1) await delay(150);
    }

    return { fieldId, value: null, label: null };
  }

  async writeValue(
    device: DeviceRefDto,
    fieldId: string,
    value: string,
  ): Promise<ControlWriteResultDto> {
    const field = (await this.listFields(device)).find(
      (candidate) => candidate.id === fieldId,
    );

    if (!field) {
      throw new NotFoundException(
        `The inverter does not expose a control field named "${fieldId}"`,
      );
    }

    return this.write(
      device,
      { id: field.id, name: field.name, value },
      field.options.find((option) => option.value === value)?.label ?? null,
    );
  }

  async applyPreferredProfile(device: DeviceRefDto): Promise<ProfileResultDto> {
    const steps: ControlWriteResultDto[] = [];

    for (const [index, step] of PREFERRED_PROFILE.entries()) {
      steps.push(
        await this.write(
          device,
          { id: step.id, name: step.name, value: step.value },
          step.label,
        ),
      );

      // Skip the settle delay after the final write.
      if (index < PREFERRED_PROFILE.length - 1)
        await delay(PROFILE_STEP_DELAY_MS);
    }

    return {
      applied: steps.filter((step) => step.success).length,
      total: steps.length,
      steps,
    };
  }

  private async write(
    device: DeviceRefDto,
    field: { id: string; name: string; value: string },
    label: string | null,
  ): Promise<ControlWriteResultDto> {
    const params: ShineParams = {
      ...deviceParams(device),
      id: field.id,
      name: field.name,
      val: field.value,
      i18n: this.shine.locale,
    };

    const result = await this.shine.call('ctrlDevice', params);
    const success = result.response.err === 0;

    this.logger[success ? 'log' : 'warn'](
      `ctrlDevice ${field.id}=${field.value} on ${device.pn} -> ${success ? 'ok' : result.response.desc}`,
    );

    return {
      fieldId: field.id,
      name: field.name,
      value: field.value,
      label,
      success,
      message: success
        ? null
        : (result.response.desc ?? 'The inverter rejected the change'),
    };
  }

  private toFieldDto(field: ShineControlField): ControlFieldDto {
    const options = (field.item ?? []).map((item) => ({
      value: String(item.key),
      label: item.val,
    }));

    return {
      id: field.id ?? 'field',
      name: field.name ?? field.id ?? 'Field',
      hint: field.hint?.trim() || null,
      inputType: resolveInputType(options.length),
      options,
    };
  }

  private cacheKey(device: DeviceRefDto): string {
    return `${device.pn}:${device.sn}:${device.devcode}:${device.devaddr}`;
  }

  private cachedFields(device: DeviceRefDto): ControlFieldDto[] | null {
    const entry = this.fieldCache.get(this.cacheKey(device));
    if (!entry || entry.expiresAt <= Date.now()) return null;
    return entry.fields;
  }

  private storeFields(device: DeviceRefDto, fields: ControlFieldDto[]): void {
    this.fieldCache.set(this.cacheKey(device), {
      fields,
      expiresAt: Date.now() + FIELD_CACHE_TTL_MS,
    });
  }
}

function resolveInputType(optionCount: number): ControlInputType {
  if (optionCount === 0) return 'text';
  return optionCount <= 2 ? 'toggle' : 'select';
}

function normalizeOptionValue(
  field: ControlFieldDto | undefined,
  raw: string,
): string {
  const trimmed = raw.trim();
  if (!field?.options.length) return trimmed;

  const byValue = field.options.find((option) => option.value === trimmed);
  if (byValue) return byValue.value;

  const byLabel = field.options.find((option) => option.label === trimmed);
  if (byLabel) return byLabel.value;

  return trimmed;
}

function resolveOptionLabel(
  field: ControlFieldDto | undefined,
  value: string,
): string | null {
  return field?.options.find((option) => option.value === value)?.label ?? null;
}

/** The upstream wraps the current value differently per firmware revision. */
function extractValue(payload: unknown): string | null {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return stringify(payload);

  const record = payload as Record<string, unknown>;
  const direct =
    record.val ??
    record.value ??
    record.current ??
    record.currentValue ??
    record.data ??
    record.result;
  if (direct !== undefined && direct !== null) return stringify(direct);

  const parameter = record.parameter;
  if (Array.isArray(parameter) && parameter.length > 0) {
    const first = parameter[0] as { val?: unknown };
    return first?.val === undefined ? null : stringify(first.val);
  }

  return null;
}
