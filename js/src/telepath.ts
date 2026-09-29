import Telepath from 'telepath-unpack';

/** The Telepath instance that unpacks the JSON the Python side embeds in the page. */
export const telepath = new Telepath();

/**
 * Teach the unpacker a constructor name the server can send (``js_constructor`` on a Python
 * Telepath adapter). Integrations such as the Quill entry point use this for their own values.
 */
export function registerAdapter(name: string, constructor: unknown): void {
    telepath.register(name, constructor);
}
