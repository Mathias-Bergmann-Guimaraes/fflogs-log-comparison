import { mergeConfig } from 'vite'
import base from './vite.config'

// TEMPORARY: the app against a throwaway API on 3199
export default mergeConfig(base, { server: { port: 5199, strictPort: true, proxy: { '/api': 'http://localhost:3199' } } })
