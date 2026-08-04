/** Raw envelope returned by every ShineMonitor endpoint. */
export interface ShineEnvelope<T = unknown> {
  err: number;
  desc?: string;
  dat?: T;
}

export interface ShineCallResult<T = unknown> {
  httpStatus: number;
  response: ShineEnvelope<T>;
  /** Upstream URL with the signature redacted — useful for debugging, safe to log. */
  redactedUrl: string;
}

export interface ShineSession {
  secret: string;
  token: string;
  uid: string;
  usr: string;
  /** Token lifetime in seconds, as reported by the upstream. */
  expire: number;
  /** Local epoch ms at which the session was established. */
  issuedAt: number;
}

/** A single measurement inside `querySPDeviceLastData` → `dat.pars`. */
export interface ShineParameter {
  id?: string;
  par?: string;
  name?: string;
  val?: string | number | null;
  unit?: string;
}

export interface ShineLastDataPayload {
  gts?: string | number;
  pars?: Record<string, ShineParameter[]>;
}

export interface ShineDevice {
  pn: string;
  sn: string;
  devcode: string | number;
  devaddr: string | number;
  devalias?: string;
  status?: number | string;
  soc?: number | string;
  energyToday?: number | string;
  outpower?: number | string;
  pid?: number | string;
}

export interface ShineControlOption {
  key: string | number;
  val: string;
}

export interface ShineControlField {
  id?: string;
  name?: string;
  hint?: string;
  item?: ShineControlOption[];
}

export interface ShineHistoryColumn {
  title?: string;
}

export interface ShineHistoryRow {
  field?: Array<string | number | null>;
}

export interface ShineHistoryPayload {
  title?: ShineHistoryColumn[];
  row?: ShineHistoryRow[];
  total?: number | string;
  page?: number | string;
  pagesize?: number | string;
}

export interface ShineWarningRow {
  title?: string;
  desc?: string;
  gts?: string;
  cts?: string;
  level?: string | number;
  code?: string | number;
}

/** One catalog entry from `queryDeviceChartField`. */
export interface ShineChartFieldRow {
  /** Field id used in DatNew `field=` */
  e0?: string;
  /** Localized display title */
  e1?: string;
  /** Internal register meta */
  e2?: string;
  /** Unit string, e.g. kW / V / A / % */
  e3?: string;
}

/** One sample inside DatNew `paramter[]` (upstream typo). */
export interface ShineChartSample {
  key?: string;
  val?: string | number | null;
}

export interface ShineChartSeriesRow {
  par?: string;
  /** Upstream spelling — not `parameter`. */
  paramter?: ShineChartSample[];
}

export interface ShineChartFieldsDatPayload {
  date?: ShineChartSeriesRow[];
}

/** One sample from `querySPDeviceKeyParameterOneDay`. */
export interface ShineKeyParameterSample {
  val?: string | number | null;
  ts?: string;
}

export interface ShineKeyParameterOneDayPayload {
  detail?: ShineKeyParameterSample[];
}

export interface ShineKeyParametersPayload {
  keys?: string[];
}

export type ShineParams = Record<
  string,
  string | number | boolean | undefined | null
>;
