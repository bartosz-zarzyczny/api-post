# API Post

A simple desktop HTTP client built with [tinyjs](https://tinyjs.app/). Send requests to any HTTP or HTTPS URL with custom headers and a body, and view the status, duration, headers, and response. Valid JSON is formatted and syntax-highlighted.

## Getting started

Install tinyjs using the [installation instructions](https://tinyjs.app/docs/install), then run the following command in the project directory:

```sh
tinyjs dev
```

To build a distributable application, run `tinyjs build`. No npm packages are required to run the application. Backend tests require Node.js: `npm test`.

### macOS

tinyjs supports macOS 15 and later on Apple Silicon and Intel Macs. On a Mac, install tinyjs, copy the project, and run `tinyjs dev` from the project directory. The application has not yet been tested on macOS.

Run `tinyjs build` on a Mac to create a macOS `.app` for that Mac's architecture. To build a universal app for both Apple Silicon and Intel, run `tinyjs build --universal`; this requires Xcode Command Line Tools (`xcode-select --install`). The Windows `.exe` cannot run on macOS.

## Usage

Use the **Theme** selector in the top bar to switch between the original Classic theme and the Orange light theme. The selection is saved between launches using tinyjs settings; the app displays a warning if it cannot save the preference.

Select a method, enter the full URL, and optionally add headers (one per line, in the format `Name: value`). You can provide a request body for methods other than GET and HEAD. Set the `Content-Type` header yourself if the API requires it. Responses with HTTP error codes are displayed like other responses; network errors are shown separately.

Use **+ New request** to open additional request tabs. Each tab keeps its own request fields, cURL import text and response, including requests that finish while another tab is active. Select a tab to return to it; use its close button to remove it. Closing a tab with content requires confirmation.

Use **Save** to save the current tab, or **Save As** to choose a new name. Save As asks before replacing an existing file; Save updates the tab's existing file. Select a file under **Saved requests** and click **Open** to open it in a new tab, or **Refresh** to reload the list after external changes. Wait for a running request to finish before saving. Unsaved tabs are lost when the app closes.

Saved tabs are JSON files in `tabs` under the application's working directory, created on the first save. They contain the request fields, imported cURL text, and the last response or error. They are **plain text and may contain tokens or sensitive response data**; protect the folder, avoid sharing it, and do not commit it. The folder is ignored by Git. External changes or concurrent app instances are not coordinated; Save overwrites the associated file.

Requests are made by the tinyjs backend, without browser CORS restrictions. Request data and API tokens are saved only when explicitly requested. The response size is the number of bytes in its UTF-8-encoded text, and the duration includes reading the response body.

### API tokens

To save a token, open **API tokens**, enter a name in **Token name** and a value in **API token**, then click **Save token**. A confirmation or an error appears below the buttons. Saving under an existing name replaces its value. To retrieve it later, select its name under **Saved token** and click **Load token**. After editing the file externally, click **Refresh list**.

If saving fails, check the displayed error, the file's contents and permissions, and the application's working directory.

The app stores tokens in `auth-keys.json` in its **working directory** (the project directory when running `tinyjs dev` from there). If the file is missing or empty, it is initialized when the first token is saved. Alternatively, copy `auth-keys-example.json` to `auth-keys.json` and edit it yourself. A non-empty file must contain a JSON object mapping names to token strings, for example:

```json
{
  "development": "replace-with-your-token"
}
```

In **API tokens**, enter a name and token and choose **Save token**, or select a saved name and choose **Load token**. Saving an existing name replaces its value. **Use as Bearer** puts the entered or loaded token in the `Authorization: Bearer ...` request header, replacing any existing Authorization header; it does not send the request. Refresh the list after editing the file externally.

`auth-keys.json` is ignored by Git; commit only `auth-keys-example.json` without real tokens. **Tokens are stored as plaintext, not encrypted.** Protect the file with appropriate filesystem permissions and do not share or commit it. The token can also appear in request headers, in code produced by **Export request** (cURL, Bash, PowerShell, and Python), and in the clipboard. The example contains an empty object, not credentials.

For a built application, the location of `auth-keys.json` depends on the working directory from which the app is launched, not on the executable's location. Invalid non-empty files are never overwritten and must be corrected before saving. Save operations replace the file atomically, but concurrent edits by other application instances or external programs are not coordinated.

### Importing cURL

Open **Import cURL command**, paste a command, and click **Import request**. Review the populated fields before sending. Importing does not execute the command or send a request, and replaces the current request fields only on success.

The importer accepts a single `curl` command using POSIX shell quoting and backslash line continuations, with an HTTP or HTTPS URL and these options: `-X`/`--request`, `-H`/`--header`, `-d`/`--data`, `--data-raw`, `--data-binary`, `--url`, `-I`/`--head`, `-L`/`--location`, and `-g`/`--globoff`. Data options imply POST unless a method is specified, and default to `Content-Type: application/x-www-form-urlencoded` when no content type is supplied. Supported methods are GET, POST, PUT, PATCH, DELETE, and HEAD.

Unsupported options, file inputs, shell expansion, multiple URLs, duplicate headers, and request bodies with GET or HEAD are rejected. Empty headers use cURL's `Name;` syntax. This is not a shell: use literal values instead of environment variables or command substitution. Imported requests use the app's normal HTTP behavior, including automatic redirects; they do not reproduce all cURL transport behavior.

### Exporting a request

Open **Export request** (the panel is collapsed by default), choose a format with the radio buttons, and click **Export**. The generated code appears in the read-only **Exported code** field; use **Copy** to copy it to the clipboard. The output is cleared when you change the request fields or switch the format, so regenerate it before copying. The code includes the request's headers and body, which may contain credentials or other sensitive data; review it before sharing.

Formats:

- **cURL** (default): a single-line command using POSIX shell quoting (macOS or Linux terminals), not Windows Command Prompt or PowerShell syntax.
- **Bash**: a script with a `#!/usr/bin/env bash` header and `set -euo pipefail`, containing the same cURL command with one argument per line; requires `curl`.
- **PowerShell**: a script that builds a parameter table and calls `Invoke-WebRequest` with `UseBasicParsing`, then prints the status code and content. Single quotes are doubled, including typographic quotes, which PowerShell also treats as quote characters.
- **Python**: a script that calls `requests.request` and prints the status code and text; requires the third-party `requests` package (`pip install requests`). The body is sent as UTF-8 bytes.

All formats follow redirects and disable cURL URL globbing. For a non-empty body without a `Content-Type` header, the export explicitly uses the application's default `text/plain;charset=UTF-8`; in PowerShell it is passed as `ContentType` instead of a header entry. GET and HEAD requests never include a body. Export rejects URLs that are not HTTP or HTTPS, URLs containing credentials, unsupported methods, invalid header names or values, and values containing NUL characters.

The code represents the request fields, not every detail of tinyjs networking; client configuration and transport behavior may differ. In particular, redirect handling with an explicit request method may differ from the app.
