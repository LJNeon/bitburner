## Dependencies

[Node.js](https://nodejs.org/en/download) required for installing dependencies.

## Installation

```bash
git clone https://github.com/bitburner-official/typescript-template
npm i
```

## How to use this template

Write all your JavaScript source code in the `/src` directory. Make sure to add the [`bitburner-sync.json`](https://github.com/Nezrahm/bitburner-sync#bitburner-syncjson) file.

To update the game with your local files, run `npm run push` in a terminal. To replace local files with the game's files, run `npm run pull`.

## Imports

To ensure the game have no issues with import paths, your import statements should follow a few formatting rules:

- Paths must be absolute from the root of `src/`, which will be equivalent to the root directory of your home drive.
- Paths must contain no leading slash.

### Examples:

To import `helperFunction` from the file `helpers.js` located in the directory `src/lib/`:

```js
import {helperFunction} from "lib/helpers.js";
```

To import all functions from the file `helpers.js` located in the `src/lib/` directory as the namespace `helpers`:

```js
import * as helpers from "lib/helpers.js";
```

To import `someFunction` from the file `main.js` located in the `src/` directory:

```js
import {someFunction} from "main.js";
```

## Debugging

For debugging bitburner on Steam you will need to enable a remote debugging port. This can be done by right-clicking bitburner in your Steam library and selecting properties. There you need to add `--remote-debugging-port=9222` [Thanks @DarkMio].
