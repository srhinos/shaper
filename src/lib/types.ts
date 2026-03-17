export type HeaderEntry = { name: string; value: string };

export type Protocol = 'http' | 'graphql' | 'grpc-web' | 'sse';

export interface Sample {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  requestHeaders: HeaderEntry[];
  requestBody: string | null;
  responseHeaders: HeaderEntry[];
  responseBody: string | null;
  status: number;
  protocol: Protocol;
  contentType: string | null;
  graphql?: GraphQLData;
  protobuf?: DecodedProtoMessage;
  sse?: SseData;
}

export interface GraphQLData {
  operationName: string | null;
  operationType: 'query' | 'mutation' | 'subscription' | null;
  query: string;
  variables: unknown;
}

export interface SseData {
  events: SseEvent[];
}

export interface SseEvent {
  type: string;
  data: string;
  id?: string;
}

export interface Endpoint {
  id: string;
  pattern: string;
  method: string;
  urlPattern: string;
  domain: string;
  protocol: Protocol;
  sampleCount: number;
  schema: InferredSchema;
}

export interface InferredSchema {
  request?: SchemaObject;
  response?: Record<string, SchemaObject>;
  pathParams?: ParamInfo[];
  queryParams?: ParamInfo[];
  proto?: InferredProtoSchema;
}

export interface ParamInfo {
  name: string;
  observedValues: string[];
  inferredType: string;
  seenCount?: number;
}

export interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: unknown[];
  nullable?: boolean;
  oneOf?: SchemaObject[];
  example?: unknown;
}

export interface UserSettings {
  maxSamplesPerEndpoint: number;
  badgeDisplay: 'endpoints' | 'samples';
  theme: 'dark';
}

export interface DecodedProtoMessage {
  fields: ProtoField[];
}

export interface ProtoField {
  number: number;
  wireType: number;
  inferredType: string;
  repeated: boolean;
  optional: boolean;
  nested?: InferredProtoSchema;
  exampleValue?: string | number | boolean;
}

export interface InferredProtoSchema {
  messageName: string;
  fields: ProtoField[];
}

export interface HeaderFilterConfig {
  enabledPresets: string[];
  customExcludes: string[];
  customIncludes: string[];
}

export interface HeaderPreset {
  id: string;
  name: string;
  description: string;
  headers: string[];
}

export interface StoredState {
  endpoints: Endpoint[];
  domainFilters: string[];
  headerFilterConfig: HeaderFilterConfig;
  settings: UserSettings;
}
