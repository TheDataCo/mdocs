// Thin client over the mdocs HTTP API. Exit-code-friendly errors for agents.
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
  ) {
    super(message)
  }
}

function codeForStatus(status: number): string {
  return (
    { 401: 'auth_failed', 403: 'permission_denied', 404: 'not_found' }[status] ??
    (status >= 500 ? 'server_error' : 'request_failed')
  )
}

export class Api {
  constructor(
    private server: string,
    private token?: string,
  ) {}

  private async req(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as object) }
    if (auth) {
      if (!this.token) throw new ApiError('auth_failed', 'Not logged in. Run `mdocs auth login`.')
      headers.Authorization = `Bearer ${this.token}`
    }
    let res: Response
    try {
      res = await fetch(`${this.server}${path}`, { ...init, headers })
    } catch (e) {
      throw new ApiError('network', `Network error reaching ${this.server}: ${(e as Error).message}`)
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      const msg = body?.error?.message ?? `HTTP ${res.status}`
      throw new ApiError(body?.error?.code ?? codeForStatus(res.status), msg, res.status)
    }
    return res
  }

  // Device-auth (unauthenticated start/poll)
  startAuth = () => this.req('/api/cli/auth/start', { method: 'POST' }, false).then((r) => r.json())
  pollAuth = (deviceCode: string) =>
    this.req('/api/cli/auth/poll', { method: 'POST', body: JSON.stringify({ device_code: deviceCode }) }, false).then(
      (r) => r.json(),
    )

  me = () => this.req('/api/me').then((r) => r.json())
  listDocs = () => this.req('/api/docs').then((r) => r.json())
  pull = (id: string) => this.req(`/api/docs/${id}/pull`).then((r) => r.json())
}
