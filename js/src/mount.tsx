import { Component, type ErrorInfo, type ReactNode, createElement } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { Bridge } from './bridge';
import { getDefaultMessages } from './messages';
import { getComponent } from './registry';
import { telepath } from './telepath';

const roots = new Map<Element, Root>();

/** Keeps one broken component from blanking the rest of the page. */
class MountBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(error, info.componentStack);
    }

    render() {
        return this.state.failed ? (
            <p role="alert" className="dreact-form-error">
                Something went wrong drawing this form.
            </p>
        ) : (
            this.props.children
        );
    }
}

function mountOne(script: HTMLScriptElement): Root | null {
    const target = document.getElementById(script.dataset.dreactFor ?? '');
    if (!target) {
        console.error(`django-react-forms: no element with id "${script.dataset.dreactFor}"`);
        return null;
    }

    let bridge: unknown;
    try {
        bridge = telepath.unpack(JSON.parse(script.textContent ?? ''));
    } catch (error) {
        console.error('django-react-forms: could not read the data for', target.id, error);
        return null;
    }
    if (!(bridge instanceof Bridge)) {
        console.error('django-react-forms: the data for', target.id, 'is not a component');
        return null;
    }

    const Registered = getComponent(bridge.component);
    const root = createRoot(target);
    root.render(
        <MountBoundary>
            {Registered ? (
                createElement(Registered, bridge.props)
            ) : (
                <p role="alert" className="dreact-form-error">
                    {getDefaultMessages().unknownComponent(bridge.component)}
                </p>
            )}
        </MountBoundary>,
    );
    return root;
}

/**
 * Draw every component the server put on the page (``form.as_react`` / ``{{ form }}``). Safe to
 * call again after inserting HTML (e.g. from a fetch): already-mounted components are skipped.
 *
 * @returns the newly created React roots
 */
export function mountAll(container: ParentNode = document): Root[] {
    const mounted: Root[] = [];
    container
        .querySelectorAll<HTMLScriptElement>('script[data-dreact-for]:not([data-dreact-mounted])')
        .forEach((script) => {
            script.dataset.dreactMounted = 'true';
            const root = mountOne(script);
            if (root) {
                const target = document.getElementById(script.dataset.dreactFor ?? '');
                if (target) roots.set(target, root);
                mounted.push(root);
            }
        });
    return mounted;
}

/** Call {@link mountAll} once the DOM is ready (immediately if it already is). */
export function mountOnReady(): void {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => mountAll(), { once: true });
    } else {
        mountAll();
    }
}

/** Remove everything {@link mountAll} drew, e.g. before a single-page navigation. */
export function unmountAll(): void {
    roots.forEach((root, target) => {
        root.unmount();
        target.replaceChildren();
    });
    roots.clear();
    document
        .querySelectorAll<HTMLScriptElement>('script[data-dreact-mounted]')
        .forEach((script) => delete script.dataset.dreactMounted);
}
