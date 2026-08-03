import { stringify } from '../../common/utils/numeric';
import type { ShineHistoryPayload } from '../../shine/shine.types';
import type {
  HistoryColumnDto,
  HistoryPageDto,
  HistoryRowDto,
  HistorySummaryItemDto,
} from '../dto/history.dto';

/** Columns that only repeat device identity and add nothing to a log table. */
const NOISE_COLUMN_PATTERN = /^(id|sn|machine type)$/i;

const TIMESTAMP_COLUMN_PATTERN = /(timestamp|time|date)/i;

/** Fallback timestamp column index, matching the upstream table layout. */
const DEFAULT_TIMESTAMP_INDEX = 1;

interface MapHistoryOptions {
  date: string;
  page: number;
  pageSize: number;
}

export function mapHistoryPage(
  payload: ShineHistoryPayload,
  options: MapHistoryOptions,
): HistoryPageDto {
  const titles = payload.title ?? [];
  const rawRows = payload.row ?? [];

  const cellsAt = (rowIndex: number): Array<string | null> => {
    const row = rawRows[rowIndex];
    const fields = Array.isArray(row?.field) ? row.field : [];
    return titles.map((_, columnIndex) => normaliseCell(fields[columnIndex]));
  };

  const constantColumns = titles.map((_, columnIndex) => {
    if (rawRows.length < 2) return false;
    const first = valueAt(rawRows, 0, columnIndex);
    return rawRows.every(
      (_, rowIndex) => valueAt(rawRows, rowIndex, columnIndex) === first,
    );
  });

  const columns: HistoryColumnDto[] = titles.map((title, index) => {
    const label = (title?.title ?? '').trim();
    return {
      index,
      title: label || `Field ${index + 1}`,
      constant: constantColumns[index],
      hidden: NOISE_COLUMN_PATTERN.test(label) || constantColumns[index],
    };
  });

  const timestampColumnIndex = resolveTimestampColumn(columns);

  const rows: HistoryRowDto[] = rawRows.map((_, rowIndex) => {
    const values = cellsAt(rowIndex);
    return {
      index: rowIndex,
      timestamp: values[timestampColumnIndex] ?? null,
      values,
    };
  });

  // Constant columns describe the device rather than the moment, so they are
  // lifted out of the table into summary cards.
  const summary: HistorySummaryItemDto[] = columns
    .filter((column) => column.constant)
    .map((column) => ({
      label: column.title,
      value: rows[0]?.values[column.index] ?? null,
    }));

  return {
    date: options.date,
    page: toInt(payload.page, options.page),
    pageSize: toInt(payload.pagesize, options.pageSize),
    total: toInt(payload.total, rows.length),
    timestampColumnIndex,
    columns,
    rows,
    summary,
  };
}

function resolveTimestampColumn(columns: HistoryColumnDto[]): number {
  const match = columns.findIndex((column) =>
    TIMESTAMP_COLUMN_PATTERN.test(column.title),
  );
  if (match >= 0) return match;
  return columns.length > DEFAULT_TIMESTAMP_INDEX ? DEFAULT_TIMESTAMP_INDEX : 0;
}

function valueAt(
  rows: ShineHistoryPayload['row'] = [],
  rowIndex: number,
  columnIndex: number,
): string {
  const fields = rows[rowIndex]?.field;
  return stringify(Array.isArray(fields) ? fields[columnIndex] : undefined);
}

function normaliseCell(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function toInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(stringify(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
