# API Post

A simple desktop HTTP client built with [tinyjs](https://tinyjs.app/). Send requests to any HTTP or HTTPS URL with custom headers and a body, and view the status, duration, headers, and response. Valid JSON is formatted and syntax-highlighted.

## Getting started

Install tinyjs using the [installation instructions](https://tinyjs.app/docs/install), then run the following command in the project directory:

```sh
tinyjs dev
```

To build a distributable application, run `tinyjs build`. No npm packages are required to run the application. Backend tests require Node.js: `npm test`.

## Usage

Select a method, enter the full URL, and optionally add headers (one per line, in the format `Name: value`). You can provide a request body for methods other than GET and HEAD. Set the `Content-Type` header yourself if the API requires it. Responses with HTTP error codes are displayed like other responses; network errors are shown separately.

Requests are made by the tinyjs backend, without browser CORS restrictions. The application does not save request data. The response size is the number of bytes in its UTF-8-encoded text, and the duration includes reading the response body.
