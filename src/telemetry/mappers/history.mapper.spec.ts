import type { ShineHistoryPayload } from '../../shine/shine.types';
import { mapHistoryPage } from './history.mapper';

const payload: ShineHistoryPayload = {
  title: [
    { title: 'ID' },
    { title: 'Timestamp' },
    { title: 'SN' },
    { title: 'Battery Voltage' },
  ],
  row: [
    { field: ['1', '2026-08-03 10:00:00', 'SN-1', '52.4'] },
    { field: ['2', '2026-08-03 10:05:00', 'SN-1', '52.1'] },
  ],
  total: 288,
  page: 0,
  pagesize: 15,
};

describe('mapHistoryPage', () => {
  const options = { date: '2026-08-03', page: 0, pageSize: 15 };

  it('detects the timestamp column by title', () => {
    const result = mapHistoryPage(payload, options);

    expect(result.timestampColumnIndex).toBe(1);
    expect(result.rows[0].timestamp).toBe('2026-08-03 10:00:00');
  });

  it('marks columns that never change across the page as constant', () => {
    const result = mapHistoryPage(payload, options);
    const serialColumn = result.columns.find((column) => column.title === 'SN');

    expect(serialColumn?.constant).toBe(true);
    expect(
      result.columns.find((column) => column.title === 'Battery Voltage')
        ?.constant,
    ).toBe(false);
  });

  it('hides identity columns from the table and lifts constants into the summary', () => {
    const result = mapHistoryPage(payload, options);

    expect(result.columns.find((column) => column.title === 'ID')?.hidden).toBe(
      true,
    );
    expect(result.summary).toEqual([{ label: 'SN', value: 'SN-1' }]);
  });

  it('prefers upstream pagination metadata over the requested values', () => {
    const result = mapHistoryPage(
      { ...payload, page: 3, pagesize: 30 },
      options,
    );

    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(30);
    expect(result.total).toBe(288);
  });

  it('handles a day with no logged rows', () => {
    const result = mapHistoryPage({ title: payload.title, row: [] }, options);

    expect(result.rows).toEqual([]);
    expect(result.summary).toEqual([]);
    expect(result.total).toBe(0);
  });
});
