// Token no localStorage: simples e sobrevive ao F5. Trade-off conhecido: um script injetado
// (XSS) conseguiria lê-lo; a alternativa (cookie httpOnly) exigiria CSRF e mesmo domínio.
const TOKEN_KEY = 'logos.token'

// try/catch: o localStorage pode estar bloqueado (navegação privada, política do navegador).
export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // Sem persistência: o login vale só enquanto a aba estiver aberta.
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // nada a limpar
    }
  },
}
