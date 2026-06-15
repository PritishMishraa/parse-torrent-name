declare namespace parseTorrentName {
  export interface ParseOptions {
    normalize?: boolean;
    includeRaw?: boolean;
    includeDebug?: boolean;
  }

  export interface ParseContext {
    input: string;
    tokens: Token[];
    options: ParseOptions;
  }

  export interface Token {
    raw: string;
    normalized: string;
    start: number;
    end: number;
    separatorBefore?: string;
    separatorAfter?: string;
    bracket?: "round" | "square" | "curly";
  }

  export interface NormalizedTorrentName {
    title?: string;
    type?: "movie" | "show";
    resolution?: string;
    source?: string;
    releaseType?: string;
    codec?: string;
    audio?: string[];
    channels?: string;
    hdr?: string[];
    service?: string;
    flags?: string[];
    languages?: string[];
    bitdepth?: number;
    samplerate?: number;
    container?: string;
  }

  export interface Candidate {
    field: string;
    raw: string;
    value: unknown;
    start: number;
    end: number;
    priority: number;
    confidence: number;
    source: string;
    consumes: boolean;
    index?: number;
  }

  export interface Rule {
    id: string;
    field: string;
    priority: number;
    match(ctx: ParseContext): Candidate[];
  }

  export interface RulePack {
    rules: Rule[];
  }

  export interface RejectedCandidate {
    candidate: Candidate;
    rejectedBy: Candidate;
    reason: string;
  }

  export interface Span {
    start: number;
    end: number;
  }

  export interface RawSpan extends Span {
    raw: string;
  }

  export interface DebugTraceEntry {
    action: "accepted" | "rejected";
    field: string;
    raw: string;
    source: string;
    start: number;
    end: number;
    reason?: string;
    rejectedBy?: {
      field: string;
      raw: string;
      source: string;
    };
  }

  export interface DebugInfo {
    candidates: Candidate[];
    accepted: Candidate[];
    rejected: RejectedCandidate[];
    consumedSpans: Span[];
    resolvedConsumedSpans: Span[];
    resolvedUnconsumedSpans: RawSpan[];
    trace: DebugTraceEntry[];
  }

  export interface ParsedTorrentName {
    raw?: string;
    title?: string;
    normalizedTitle?: string;
    season?: number;
    episode?: number | number[];
    episodeName?: string;
    year?: number;
    resolution?: string;
    source?: string;
    quality?: string;
    codec?: string;
    audio?: string;
    audios?: string[];
    atmos?: boolean;
    channels?: string;
    color?: string;
    colors?: string[];
    service?: string;
    services?: string[];
    language?: string;
    languages?: string[];
    group?: string;
    encoder?: string;
    container?: string;
    region?: string;
    garbage?: string;
    flags?: string[];
    extended?: boolean;
    theatrical?: boolean;
    uncut?: boolean;
    unrated?: boolean;
    openmatte?: boolean;
    hybrid?: boolean;
    remux?: boolean;
    hardcoded?: boolean;
    proper?: boolean;
    repack?: boolean;
    internal?: boolean;
    retail?: boolean;
    remastered?: boolean;
    widescreen?: boolean;
    website?: string;
    bitdepth?: number;
    samplerate?: number;
    excess?: string | string[];
    normalized?: NormalizedTorrentName;
    debug?: DebugInfo;
    [field: string]: unknown;
  }

  export class Parser {
    constructor();
    addRule(rule: Rule): this;
    use(rulePack: Rule[] | RulePack): this;
    parse(name: string, options?: ParseOptions): ParsedTorrentName;
  }
}

declare function parseTorrentName(
  name: string,
  options?: parseTorrentName.ParseOptions,
): parseTorrentName.ParsedTorrentName;

export = parseTorrentName;
