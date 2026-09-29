/**
 * What the server's ``ReactRenderableMixin`` sends: the key of a registered component and its
 * props. Telepath builds it (``dreact.Bridge``) with the props already unpacked, so a form arrives
 * as a ``FormDef``.
 */
export class Bridge {
    component: string;
    props: Record<string, any>;

    constructor(component: string, props: Record<string, any>) {
        this.component = component;
        this.props = props || {};
    }
}
