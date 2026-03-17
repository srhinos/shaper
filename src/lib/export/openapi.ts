import type { Endpoint, ParamInfo } from '../types';

export function generateOpenAPI(endpoints: Endpoint[], domain?: string): any {
  const filtered = domain ? endpoints.filter(e => e.domain === domain) : endpoints;
  const targetDomain = domain || filtered[0]?.domain || 'unknown';

  const paths: Record<string, any> = {};

  for (const ep of filtered) {
    const openApiPath = convertPath(ep.urlPattern);
    if (!paths[openApiPath]) paths[openApiPath] = {};

    const method = ep.method.toLowerCase();
    const operation: any = {};

    if (ep.protocol === 'graphql') {
      operation['x-shaper-synthetic'] = true;
      const opName = ep.urlPattern.split('/').pop();
      if (opName && !opName.startsWith('_unnamed')) {
        operation.operationId = opName;
      }
    }

    const params = buildParameters(ep.schema.pathParams, ep.schema.queryParams);
    if (params.length > 0) operation.parameters = params;

    if (ep.schema.request && ['post', 'put', 'patch'].includes(method)) {
      operation.requestBody = {
        content: { 'application/json': { schema: ep.schema.request } },
      };
    }

    const responses: Record<string, any> = {};
    if (ep.schema.response) {
      for (const [status, schema] of Object.entries(ep.schema.response)) {
        responses[status] = {
          description: `Status ${status}`,
          content: { 'application/json': { schema } },
        };
      }
    }
    if (Object.keys(responses).length === 0) {
      responses['200'] = { description: 'OK' };
    }
    operation.responses = responses;

    paths[openApiPath][method] = operation;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: `Captured API — ${targetDomain}`,
      version: 'shaper-export',
    },
    servers: [{ url: `https://${targetDomain}` }],
    paths,
  };
}

export function generateOpenAPIPerDomain(endpoints: Endpoint[]): any[] {
  const domains = [...new Set(endpoints.map(e => e.domain))];
  return domains.map(d => generateOpenAPI(endpoints, d));
}

function convertPath(urlPattern: string): string {
  return urlPattern
    .replace(/:uuid/g, '{uuid}')
    .replace(/:id/g, '{id}')
    .replace(/:token/g, '{token}')
    .replace(/:(\w+)/g, '{$1}');
}

function buildParameters(pathParams?: ParamInfo[], queryParams?: ParamInfo[]): any[] {
  const params: any[] = [];

  if (pathParams) {
    for (const p of pathParams) {
      const name = p.name.replace(/^:/, '');
      params.push({
        name,
        in: 'path',
        required: true,
        schema: { type: p.inferredType || 'string' },
      });
    }
  }

  if (queryParams) {
    for (const p of queryParams) {
      params.push({
        name: p.name,
        in: 'query',
        schema: { type: p.inferredType || 'string' },
      });
    }
  }

  return params;
}
