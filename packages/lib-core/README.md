# NextGuide core — internal workspace module

Private internal core module used to compile NextGuide's `nextguide/core` export. Includes navigation/TOC types, slug helpers and URL validation.

**Do not install or publish this workspace package separately.** The public, all-in-one API ships as [`nextguide`](https://www.npmjs.com/package/nextguide):

```powershell
bun add nextguide
```

```ts
import * as core from "nextguide/core"
```

The official documentation and component gallery are at https://m1nsook.github.io/NextGuide/.

## License

NextGuide is MIT licensed. This internal module retains original upstream MIT copyright and permission notices in its `LICENSE`, and the published package retains the required third-party attribution in `THIRD_PARTY_NOTICES.md`.
