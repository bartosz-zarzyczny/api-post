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

Requests are made by the tinyjs backend, without browser CORS restrictions. The application does not save request data except API tokens explicitly saved as described below. The response size is the number of bytes in its UTF-8-encoded text, and the duration includes reading the response body.

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

`auth-keys.json` is ignored by Git; commit only `auth-keys-example.json` without real tokens. **Tokens are stored as plaintext, not encrypted.** Protect the file with appropriate filesystem permissions and do not share or commit it. The token can also appear in request headers, exported cURL commands and the clipboard. The example contains an empty object, not credentials.

For a built application, the location of `auth-keys.json` depends on the working directory from which the app is launched, not on the executable's location. Invalid non-empty files are never overwritten and must be corrected before saving. Save operations replace the file atomically, but concurrent edits by other application instances or external programs are not coordinated.

### Importing cURL

Open **Import cURL command**, paste a command, and click **Import request**. Review the populated fields before sending. Importing does not execute the command or send a request, and replaces the current request fields only on success.

The importer accepts a single `curl` command using POSIX shell quoting and backslash line continuations, with an HTTP or HTTPS URL and these options: `-X`/`--request`, `-H`/`--header`, `-d`/`--data`, `--data-raw`, `--data-binary`, `--url`, `-I`/`--head`, `-L`/`--location`, and `-g`/`--globoff`. Data options imply POST unless a method is specified, and default to `Content-Type: application/x-www-form-urlencoded` when no content type is supplied. Supported methods are GET, POST, PUT, PATCH, DELETE, and HEAD.

Unsupported options, file inputs, shell expansion, multiple URLs, duplicate headers, and request bodies with GET or HEAD are rejected. Empty headers use cURL's `Name;` syntax. This is not a shell: use literal values instead of environment variables or command substitution. Imported requests use the app's normal HTTP behavior, including automatic redirects; they do not reproduce all cURL transport behavior.

### Exporting cURL

Open **Export as cURL** and select **Generate command**, then copy the command or use **Copy command**. Regenerate it after changing the request. The command uses POSIX shell quoting (for example, in macOS or Linux terminals), not Windows Command Prompt or PowerShell syntax. It includes the request's headers and body, which may contain credentials or other sensitive data; review it before sharing.

The export follows redirects and disables cURL URL globbing. For a non-empty body without a `Content-Type` header, it explicitly uses the application's default `text/plain;charset=UTF-8`. The command represents the request fields, not every detail of tinyjs networking; cURL configuration and transport behavior may differ. In particular, redirect handling with an explicit request method may differ from the app.
