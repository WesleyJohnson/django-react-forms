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

`python/README.md` and `python/LICENSE` are copies of the root files (a package can't reference files
outside its folder). After editing either root file, run `cp README.md LICENSE python/`. CI fails if they drift.
