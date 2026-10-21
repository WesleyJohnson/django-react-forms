# django-react-forms for PyCharm

Cmd/Ctrl+click a component key to open the React component registered under it:

```python
class Dashboard(ReactRenderableMixin):
    component = 'Dashboard'                            # -> the component passed to registerComponent

ReactComponentWidget(attrs, component='TagInput')      # keyword arguments too
```

```django
{% react_component "Badge" label="Active" %}          {# the key in the template tag #}
```

Typing inside `component = ''` offers every registered key.

Keys come from `registerComponent(...)` and `registerWidget(...)` calls anywhere in the project's
JavaScript and TypeScript (not `node_modules`): a string key, or a loop over a map of them:

```ts
registerWidget('TagInput', TagInput);

const components = { Dashboard, 'billing.Invoice': Invoice };
for (const [name, component] of Object.entries(components)) registerComponent(name, component);
```

Templates are matched on the text around the caret, so they work without PyCharm's Django support.
A key held in a variable (`{% react_component block.name %}`) can't be followed. The plugin needs
PyCharm 2026.2 or newer with JavaScript and TypeScript support.

## Building

Gradle needs JDK 21 or newer. PyCharm's own runtime works:
`export JAVA_HOME="/Applications/PyCharm.app/Contents/jbr/Contents/Home"` (Toolbox installs to
`~/Applications`).

```bash
./gradlew test          # headless tests
./gradlew runIde        # a sandboxed PyCharm with the plugin loaded
./gradlew buildPlugin   # build/distributions/django-react-forms-pycharm-<version>.zip
```

Without options these download PyCharm (about 1 GB) the first time. To use one you have, add
`-PlocalIde=/Applications/PyCharm.app`, or put `localIde=...` in `~/.gradle/gradle.properties`.

To install: Settings, Plugins, the gear icon, Install Plugin from Disk, then pick the zip.
