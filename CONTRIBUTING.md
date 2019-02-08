# Contributing to JupyterLab

If you're reading this section, you're probably interested in contributing to
JupyterLab. Welcome and thanks for your interest in contributing!

Please take a look at the Contributor documentation, familiarize yourself with
using JupyterLab, and introduce yourself on the mailing list and share
what area of the project you are interested in working on. Please see also the
Jupyter [Community Guides](https://jupyter.readthedocs.io/en/latest/community/content-community.html).

We have labeled some issues as [good first issue](https://github.com/jupyterlab/jupyterlab/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) or [help wanted](https://github.com/jupyterlab/jupyterlab/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
that we believe are good examples of small, self-contained changes.
We encourage those that are new to the code base to implement and/or ask
questions about these issues.

## Tag Issues with Labels

Users without the commit rights to the jupyterlab repository can also tag the issues with labels. For example: To apply the label `foo` and `bar baz` to an issue, comment `@meeseeksdev tag foo "bar baz"` on the issue.

## General Guidelines

For general documentation about contributing to Jupyter projects, see the
[Project Jupyter Contributor Documentation](https://jupyter.readthedocs.io/en/latest/contributor/content-contributor.html) and [Code of Conduct](https://github.com/jupyter/governance/blob/master/conduct/code_of_conduct.md).

All source code is written in
[TypeScript](http://www.typescriptlang.org/Handbook). See the [Style
Guide](https://github.com/jupyterlab/jupyterlab/wiki/TypeScript-Style-Guide).

All source code is formatted using [prettier](https://prettier.io).
When code is modified and committed, all staged files will be automatically
formatted using pre-commit git hooks (with help from the
[lint-staged](https://github.com/okonet/lint-staged) and
[husky](https://github.com/typicode/husky) libraries). The benefit of using a
code formatter like prettier is that it removes the topic of code style from the conversation
when reviewing pull requests, thereby speeding up the review process.

You may also use the prettier npm script (e.g. `npm run prettier` or `yarn prettier` or `jlpm prettier`) to format the entire code base. We recommend
installing a prettier
extension for your code editor and configuring it to format your code with
a keyboard shortcut or automatically on save.

## Setting Up a Development Environment

### Installing Node.js and jlpm

Building JupyterLab from its GitHub source code requires Node.js.

If you use `conda`, you can get it with:

```bash
conda install -c conda-forge 'nodejs'
```

If you use [Homebrew](http://brew.sh/) on Mac OS X:

```bash
brew install node
```

You can also use the installer from the [Node.js](https://nodejs.org) website.

## Installing JupyterLab

JupyterLab requires Jupyter Notebook version 4.3 or later.

If you use `conda`, you can install notebook using:

```bash
conda install -c conda-forge notebook
```

You may also want to install `nb_conda_kernels` to have a kernel option for different [conda environments](https://docs.conda.io/projects/conda/en/latest/user-guide/tasks/manage-environments.html)

```bash
conda install -c conda-forge nb_conda_kernels
```

If you use `pip`, you can install notebook using:

```bash
pip install notebook
```

Fork the JupyterLab [repository](https://github.com/jupyterlab/jupyterlab).

Once you have installed the dependencies mentioned above, use the following
steps:

```bash
git clone https://github.com/<your-github-username>/jupyterlab.git
cd jupyterlab
pip install -e .
jlpm install
jlpm run build  # Build the dev mode assets (optional)
jlpm run build:core  # Build the core mode assets (optional)
jupyter lab build  # Build the app dir assets (optional)
```

Notes:

- A few of the scripts will run "python". If your target python is called something else (such as "python3") then parts of the build will fail. You may wish to build in a conda environment, or make an alias.

- The `jlpm` command is a JupyterLab-provided, locked version of the [yarn](https://yarnpkg.com/en/) package manager. If you have `yarn` installed
  already, you can use the `yarn` command when developing, and it will use the
  local version of `yarn` in `jupyterlab/yarn.js` when run in the repository or
  a built application directory.

- At times, it may be necessary to clean your local repo with the command `npm run clean:slate`. This will clean the repository, and re-install and
  rebuild.

- If `pip` gives a `VersionConflict` error, it usually means that the installed
  version of `jupyterlab_server` is out of date. Run `pip install --upgrade jupyterlab_server` to get the latest version.

- To install JupyterLab in isolation for a single conda/virtual environment, you can add the `--sys-prefix` flag to the extension activation above; this will tie the installation to the `sys.prefix` location of your environment, without writing anything in your user-wide settings area (which are visible to all your envs):

- You can run `jlpm run build:dev:prod` to build more accurate sourcemaps that show the original
  Typescript code when debugging. However, it takes a bit longer to build the sources, so is used only to build for production
  by default.

If you are using a version of Jupyter Notebook earlier than 5.3, then
you must also run the following command to enable the JupyterLab
server extension:

```bash
jupyter serverextension enable --py --sys-prefix jupyterlab
```

For installation instructions to write documentation, please see [Writing Documentation](#writing-documentation)

### Run JupyterLab

Start JupyterLab in development mode:

```bash
jupyter lab --dev-mode
```

Development mode ensures that you are running the JavaScript assets that are
built in the dev-installed Python package. When running in dev mode, a red
stripe will appear at the top of the page; this is to indicate running
an unreleased version.

### Build and Run the Tests

```bash
jlpm run build:test
jlpm test
```

You can run tests for an individual package by changing to the appropriate
folder in tests:

```bash
cd tests/test-notebook
jlpm test
```

Note: We are in the process of changing our test suite over to use `jest`. For folders
that have a `jest.conf.js` file, please see the `jest` specific instructions below.

You can also select specific test file(s) to run using a pattern:

```bash
cd tests/test-notebook
jlpm test --pattern=src/*.spec.ts
jlpm test --pattern=src/history.spec.ts
```

You can run `jlpm watch` from a test folder, and it will re-run the tests
when the source file(s) change. Note that you have to launch the browser
of your choice after it says `No captured browser`. You can put a `debugger`
statement on a line and open the browser debugger to debug specific tests.
`jlpm watch` also accepts the `--pattern` argument.

Note that there are some helper functions in `testutils` (which is a public npm package called `@jupyterlab/testutils`) that are used by many of the tests.

We use `karma` to run our tests in a browser, `mocha` as the test framework, and `chai` for test assertions. We use [async/await](https://mochajs.org/#using-async--await) for asynchronous tests. We have
a helper function in `@jupyterlab/testutils` called `testEmission` to help with
writing tests that use `Phosphor` signals, as well as a `framePromise` function
to get a `Promise` for a `requestAnimationFrame`. We sometimes have to set
a sentinel value inside a `Promise` and then check that the sentinel was set if
we need a promise to run without blocking.

To create a new test for a package in `packages/`, use the following
command, where `<package-directory-name>` is the name of the folder in
`packages/`:

```bash
jlpm create:test <package-directory-name>
```

#### Running Jest Tests

For those test folders that use `jest`, they can be run as `jlpm test` to run the files
directly. You can also use `jlpm test --namePattern=<regex>` to specify specific test
suite names, and `jlpm test --pathPattern=<regex>` to specify specific test module names. In order to watch the code, add a `debugger` line in your code and run `jlpm watch`. This will start a node V8 debugger, which can be debugged
in Chrome by browsing to `chrome://inspect/` and launching the remote session.

### Build and run the stand-alone examples

To install and build the examples in the `examples` directory:

```bash
jlpm run build:examples
```

To run a specific example, change to the examples directory (i.e.
`examples/filebrowser`) and enter:

```bash
python main.py
```

## Debugging

All methods of building JupyterLab produce source maps. The source maps
should be available in the source files view of your browser's development
tools under the `webpack://` header.

When running JupyterLab normally, expand the `~` header to see the source maps for individual packages.

When running in `--dev-mode`, the core packages are available under
`packages/`, while the third party libraries are available under `~`.
Note: it is recommended to use `jupyter lab --watch --dev-mode` while
debugging.

When running a test, the packages will be available at the top level
(e.g. `application/src`), and the current set of test files available under
`/src`. Note: it is recommended to use `jlpm run watch` in the test folder
while debugging test options. See [above](#build-and-run-the-tests) for more info.

---

## High level Architecture

The JupyterLab application is made up of two major parts:

- an npm package
- a Jupyter server extension (Python package)

Each part is named `jupyterlab`. The [developer tutorial documentation](https://jupyterlab.readthedocs.io/en/latest/index.html)
provides additional architecture information.

## The NPM Packages

The repository consists of many npm packages that are managed using the lerna
build tool. The npm package source files are in the `packages/` subdirectory.

### Build the NPM Packages from Source

```bash
git clone https://github.com/jupyterlab/jupyterlab.git
cd jupyterlab
pip install -e .
jlpm
jlpm run build:packages
```

**Rebuild**

```bash
jlpm run clean
jlpm run build:packages
```

## [Writing Documentation](#writing-documenation)

Documentation is written in Markdown and reStructuredText. In particular, the documentation on our Read the Docs page is written in reStructuredText. To ensure that the Read the Docs page builds, you'll need to install the documentation dependencies with `conda`. These dependencies are located in `docs/environment.yml`. You can install the dependencies for building the documentation by creating a new conda environment:

```bash
conda env create -f docs/environment.yml
```

Alternatively, you can install the documentation dependencies in an existing environment using the following command:

```bash
conda env update -n <ENVIRONMENT> -f docs/environment.yml
```

The Developer Documentation includes a [guide](http://jupyterlab.readthedocs.io/en/latest/developer/documentation.html) to writing documentation including writing style, naming conventions, keyboard shortcuts, and screenshots.

To test the docs run:

```
py.test --check-links -k .md . || py.test --check-links -k .md --lf .
```

The Read the Docs pages can be built using `make`:

```bash
cd docs
make html
```

Or with `jlpm`:

```
jlpm run docs
```

## The Jupyter Server Extension

The Jupyter server extension source files are in the `jupyterlab/`
subdirectory. To use this extension, make sure the Jupyter Notebook server
version 4.3 or later is installed.

### Build the JupyterLab server extension

When you make a change to JupyterLab npm package source files, run:

```bash
jlpm run build
```

to build the changes, and then refresh your browser to see the changes.

To have the system build after each source file change, run:

```bash
jupyter lab --dev-mode --watch
```

## Build Utilities

There is a range of build utilities for maintaining the repository.
To get a suggested version for a library use `jlpm run get:dependency foo`.
To update the version of a library across the repo use `jlpm run update:dependency foo ^latest`.
To remove an unwanted dependency use `jlpm run remove:dependency foo`.

The key utility is `jlpm run integrity`, which ensures the integrity of
the packages in the repo. It will:

- Ensure the core package version dependencies match everywhere.
- Ensure imported packages match dependencies.
- Ensure a consistent version of all packages.
- Manage the meta package.

The `packages/metapackage` package is used to build all of the TypeScript
in the repository at once, instead of 50+ individual builds.

The integrity script also allows you to automatically add a dependency for
a package by importing from it in the TypeScript file, and then running:
`jlpm run integrity` from the repo root.

We also have scripts for creating and removing packages in `packages/`,
`jlpm run create:package` and `jlpm run remove:package`.

## Testing Changes to External Packages

### Linking/Unlinking Packages to JupyterLab

If you want to make changes to one of JupyterLab's external packages (for example, [Phosphor](https://github.com/phosphorjs/phosphor)) and test them out against your copy of JupyterLab, you can easily do so using the `link` command:

1.  Make your changes and then build the external package
2.  Register a link to the modified external package
    - navigate to the external package dir and run `jlpm link`
3.  Link JupyterLab to modded package
    - navigate to top level of your JupyterLab repo, then run `jlpm link "<package-of-interest>"`

You can then (re)build JupyterLab (eg `jlpm run build`) and your changes should be picked up by the build.

To restore JupyterLab to its original state, you use the `unlink` command:

1.  Unlink JupyterLab and modded package
    - navigate to top level of your JupyterLab repo, then run `jlpm unlink "<package-of-interest>"`
2.  Reinstall original version of the external package in JupyterLab
    - run `jlpm install --check-files`

You can then (re)build JupyterLab and everything should be back to default.

### Possible Linking Pitfalls

If you're working on an external project with more than one package, you'll probably have to link in your copies of every package in the project, including those you made no changes to. Failing to do so may cause issues relating to duplication of shared state.

Specifically, when working with Phosphor, you'll probably have to link your copy of the `"@phosphor/messaging"` package (in addition to whatever packages you actually made changes to). This is due to potential duplication of objects contained in the `MessageLoop` namespace provided by the `messaging` package.

## Notes

- By default, the application will load from the JupyterLab staging directory (default is `<sys-prefix>/share/jupyter/lab/build`. If you wish to run
  the core application in `<git root>/jupyterlab/build`,
  run `jupyter lab --core-mode`. This is the core application that will
  be shipped.

- If working with extensions, see the extension documentation on
  https://jupyterlab.readthedocs.io/en/latest/index.html.

- The npm modules are fully compatible with Node/Babel/ES6/ES5. Simply
  omit the type declarations when using a language other than TypeScript.

- For more information, read the [documentation](http://jupyterlab.readthedocs.io/en/latest/).
