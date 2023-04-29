# Contributing

## Publishing

Publishing to `npm` is done via Github Actions with the `.github/workflows/release.yml` action which is triggered automatically whenever there's a new release created in Github.

The creation of Github releases is done with the [np](npm.im/np) npm package and the `--no-publish` flag, so that it skips the publishing part which is going to be handled by the action mentioned above.

```bash
np --no-publish
```

The reason why I release with a Github action is so that I can use the `--provenance` feature of `npm`, which is only available when packages are released through a trusted CI/CD platform. Read more [here](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance)
