declare module 'telepath-unpack' {
    export default class Telepath {
        constructors: Record<string, unknown>;
        register(name: string, constructor: unknown): void;
        unpack(packed: unknown): any;
    }
}
