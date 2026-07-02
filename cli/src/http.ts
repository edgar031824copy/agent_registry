import axios from 'axios'

const BASE_URL = process.env.AGENT_REGISTRY_URL ?? 'http://localhost:3001'

export const http = axios.create({ baseURL: BASE_URL })
