// 127.0.0.1 e não "localhost": no Windows, "localhost" tenta IPv6 primeiro e pode atrasar
// cada requisição em ~2 s antes de cair para o IPv4 em que a API local escuta.
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
