import { getVersion } from '@tauri-apps/api/app'

export const getAppVersion = (): Promise<string> => getVersion()
