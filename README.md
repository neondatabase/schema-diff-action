# 🔍 Neon Schema Diff Action

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/neon-logo-dark-color.svg">
    <img alt="Neon logo" src="./docs/neon-logo-light-color.svg">
  </picture>
</p>

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/luist18/refactored-giggle/.github%2Fworkflows%2Flinter.yml?label=%F0%9F%94%8D%20Lint)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/luist18/refactored-giggle/.github%2Fworkflows%2Fci.yml?label=%F0%9F%8F%97%EF%B8%8F%20Build)
[![coverage](./docs/coverage.svg)](./docs/coverage.svg)

This action makes it easy to have automated schema changes in your GitHub Pull
Requests.

Use this action to get GitHub Pull Request comments with the changes in the
database schema in your Neon branches. These are the requirements to use this
action:

- Neon project
- Neon GitHub integration installed or an API key

---

## Develop

See [docs/development.md](docs/development.md)

## How to set up the NEON_API_KEY

**(👍 Recommended)** Neon has a GitHub integration that allows you to quickly
link your GitHub repositories with your Neon projects, enabling these kinds of
features like this action. Please
[follow the guide](https://neon.tech/docs/guides/neon-github-integration) to
install the GitHub integration on your repository.

Alternatively, you can navigate to account settings on the Neon console
(top-right corner). Select the API keys tab on your account page and generate an
API key. Store it secretly and add it to your GitHub repository secrets
(Settings -> Secrets and Variables -> Actions -> Secrets tab). Set it under the
name `NEON_API_KEY`. button.

## Usage

Setup the action:

```yml
steps:
  - uses: neondatabase/schema-diff-action@v1
    with:
      project_id: rapid-haze-373089
      compare_branch:
        preview/pr-${{ github.event.number }}-${{ needs.setup.outputs.branch }}
      api_key: ${{ secrets.NEON_API_KEY }}
```

Alternatively, you can also use `${{ vars.NEON_PROJECT_ID }}` to get your
`project_id`. If you have set up the Neon GitHub integration correctly, the
`NEON_PROJECT_ID` variable will be defined.

By default, the schema diff will be calculated between the `compare_branch` and
its parent. If it has no parent, then it will fail. If you want to define the
base branch add the `base_branch` field. Both `compare_branch` and `base_branch`
accept either the name or the ID of the branch, you can even mix the types
between the fields (_i.e._, `compare_branch` uses the branch name and
`base_branch` uses the branch ID or vice-versa).

If your branch has more than one database or role see the
[advanced usage section](#advanced-usage) below.

## Advanced usage

The following fields are required to run the schema diff action:

- `project_id`, the Neon project ID. If you have the GitHub integration
  installed, you can access this field with `${{ vars.NEON_PROJECT_ID }}`
- `api_key`, the Neon API key to access the databases. If you have the GitHub
  integration installed, you can access this field with
  `${{ secrets.NEON_API_KEY }}`
- `compare_branch`, the name or ID of the branch to compare

If you don't fill in the following fields, the action will populate the
following extra parameters:

- `github-token` with `${{ github.token }}`, this is the ephemeral GitHub token
  used to create comments
- `api_host` with `https://console.neon.tech/api/v2`
- `username` with `neondb_owner`, the default role for new projects
- `database` with `neondb`, the default database name for new projects

The GitHub token is required to create PR comments. This value
(`${{ github.token }}`) is
[automatically populated by GitHub](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)
with a unique value to use in each workflow job.

By default, Neon creates a database with the name `neondb` with a `neondb_owner`
role. If you intend to use other names, please add the fields explicitly in the
action.

If you don't want the schema comparison to happen with the parent branch of
`compare_branch` you can explicitly specify the base branch with the
`base_branch` field. The action below compares the schema with the `main` branch
excplicitly.

```yml
steps:
  - uses: neondatabase/schema-diff-action@v1
    with:
      project_id: ${{ vars.NEON_PROJECT_ID }}
      compare_branch:
        preview/pr-${{ github.event.number }}-${{ needs.setup.outputs.branch }}
      base_branch: main
      api_key: ${{ secrets.NEON_API_KEY }}
      database: mydatabase
      username: myrole
```

Additionally, you can set up extra parameters to control the state of your
compare branch for comparison. The fields `timestamp` and `lsn` allow you to
specify a point in time in your compare branch, which will be used for schema
comparison. Only one value can be defined at a time.

List of input fields

| Field            | Required/optional | Default value                            |
| ---------------- | ----------------- | ---------------------------------------- |
| `project_id`     | required          | n/a                                      |
| `compare_branch` | required          | n/a                                      |
| `api_key`        | required          | n/a                                      |
| `base_branch`    | optional          | empty, will default to the parent branch |
| `api_host`       | optional          | `https://console.neon.tech/api/v2`       |
| `username`       | optional          | `neondb_owner`                           |
| `database`       | optional          | `neondb`                                 |
| `lsn`            | optional          | empty, will default to the branch's head |
| `timestamp`      | optional          | empty, will default to the branch's head |

## Outputs

The action provides two outputs:

- `diff` the SQL patch diff
- `comment_url` the URL of the created/updated comment

## 🚧 New coming features

- [ ] Split long diffs into multiple comments. Context, GitHub has a limit of
      65535 characters per comment
- [x] Support for two branch comparison instead of comparing with parent
- [x] Support for LSN and timestamp fields
- [x] Support for branch IDs in addition to branch names
