# Contributing to Mapforge

Mapforge is an open source project. Every contribution helps: a bug report, a feature proposal, a translation, a documentation fix or code.

## Ask a question or discuss an idea

Use [GitHub Discussions](https://github.com/mapforge-org/mapforge/discussions) for questions, ideas and feedback.

## Report a bug / feature request

1. Search the [open issues](https://github.com/mapforge-org/mapforge/issues) for your problem.
2. If there is no issue, [open a new issue](https://github.com/mapforge-org/mapforge/issues/new).
3. Add the steps to reproduce the problem, the expected result and the actual result (screenshots if available).
4. Add your browser and your operating system.

Do not put a private map link into an issue. Everybody can read the issue and then edit your map.

## Contribute code

Before you start, read
[DEVELOPMENT.md](https://github.com/mapforge-org/mapforge/blob/main/DEVELOPMENT.md). It explains the setup of a development environment.

1. Fork the repository and create a branch.
2. Make your change. Keep it small and limited to one topic.
3. Add a test for new behavior.
4. Run the linters: `bin/rubocop`, `npm run lint:js` and `npm run lint:css`.
5. Run the tests: `bin/rspec`.
6. Open a pull request and describe your change.

GitHub Actions runs the linters and the tests for each pull request.

## Contribute a translation

Mapforge uses gettext. The locale files are in `locale/<lang>/app.po`.

- To improve a translation, edit the `msgstr` lines in the file of your language.
- To add a language, copy `locale/app.pot` to `locale/<lang>/app.po` and translate it.

## License

Mapforge uses the [AGPL v3](https://github.com/mapforge-org/mapforge/blob/main/LICENSE) license.
