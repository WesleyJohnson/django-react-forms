# Contributing

Thanks for taking a look. This is a small project maintained on a best-effort basis: issues and pull
requests are welcome, but replies may take a while.

## Setup

```bash
# Python (Django 4.2+, telepath, django-quill-editor, nh3)
cd python && python -m django test tests --settings=tests.settings   # with PYTHONPATH=.

# JS
cd js && npm install && npm test && npm run typecheck && npm run build
```

## Before you open a pull request

- Add or update tests. Behavior changes need a test that fails without the change.
- `ruff format python && ruff check python`, and `npm run format` in `js/`.
- If you change what the Python side sends to the client, regenerate the contract fixtures
  (`DREACT_UPDATE_FIXTURES=1 python -m django test tests.test_contract`), commit them, and make sure
  the JS tests pass against them.
- The condition rules exist in Python and in TypeScript; both are tested against
  `python/tests/fixtures/condition-cases.json`. Change the rules in both places and add a case.

## Scope

The core is deliberately small: standard Django widgets, conditional fields, tags, files, and a
registry for everything else. Design-system components, extra rich-text editors and the like are
better as separate packages that use `registerWidget` / `registerSlot`.

## Keeping the packaged README/LICENSE in sync

`python/` and `js/` each carry copies of the root `README.md` and `LICENSE` (a package can't
reference files outside its folder). After editing either root file, run
`cp README.md LICENSE python/ && cp README.md LICENSE js/`. CI fails if they drift.

## Releasing

A version tag publishes both packages (`.github/workflows/release.yml`):

1. Move the `CHANGELOG.md` entry from "unreleased" to the version and date.
2. Set the same version in `python/pyproject.toml` and `js/package.json` (the release workflow
   checks that they match the tag).
3. Commit, wait for CI to pass on `main`, then `git tag v0.1.0 && git push --tags`.

One-time setup:

- **PyPI:** at pypi.org, add a *pending publisher* for project `django-react-forms` (owner
  `WesleyJohnson`, repository `django-react-forms`, workflow `release.yml`, environment `pypi`),
  and create a GitHub environment named `pypi` in the repository settings. No token is stored.
- **npm:** publish the first version by hand (`cd js && npm publish --access public`), then add an
  npm automation token as the repository secret `NPM_TOKEN` for later releases. Until that secret
  exists the `npm` job skips itself (it can be re-run later from the Actions page).
- **GitHub Release:** every tag also creates a release with the wheel, the sdist and the JS tarball
  attached. The tarball installs without npm: point `package.json` at
  `https://github.com/WesleyJohnson/django-react-forms/releases/download/v0.1.0/django-react-forms-0.1.0.tgz`.
