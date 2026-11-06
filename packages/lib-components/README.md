# NextGuide components — internal workspace module

Private internal documentation renderer used to compile NextGuide's `nextguide/components` export, including `Docs`, `OpenAPI`, code windows and documentation styles.

**Do not install or publish this workspace package separately.** The public, all-in-one API ships as [`nextguide`](https://www.npmjs.com/package/nextguide):

```powershell
bun add nextguide
```

```ts
import * as components from "nextguide/components"
```

The official documentation and component gallery are at https://m1nsook.github.io/NextGuide/.

## License

NextGuide is MIT licensed. This internal module retains original upstream MIT copyright and permission notices in its `LICENSE`, and the published package retains the required third-party attribution in `THIRD_PARTY_NOTICES.md`.
