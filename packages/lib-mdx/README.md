# NextGuide mdx — internal workspace module

Private internal MDX module used to compile NextGuide's `nextguide/mdx`, `nextguide/mdx/server`, `nextguide/mdx/client` and `nextguide/mdx/plugins` exports.

**Do not install or publish this workspace package separately.** The public, all-in-one API ships as [`nextguide`](https://www.npmjs.com/package/nextguide):

```powershell
bun add nextguide
```

```ts
import * as mdx from "nextguide/mdx"
```

The official documentation and component gallery are at https://m1nsook.github.io/NextGuide/.

## License

NextGuide is MIT licensed. This internal module retains original upstream MIT copyright and permission notices in its `LICENSE`, and the published package retains the required third-party attribution in `THIRD_PARTY_NOTICES.md`.
