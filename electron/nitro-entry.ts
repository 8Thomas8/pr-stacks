// Nitro entry for the desktop build: instead of listening on a port, expose the app as a
// fetch-style handler that Electron's main process plugs into its `app://` protocol.
import '#nitro-internal-pollyfills'
import { toWebHandler } from 'h3'
import { useNitroApp } from 'nitropack/runtime'
import { trapUnhandledNodeErrors } from 'nitropack/runtime/internal'

export const handler = toWebHandler(useNitroApp().h3App)
// log stray server errors instead of letting Electron pop its "error in the main process" dialog
trapUnhandledNodeErrors()
