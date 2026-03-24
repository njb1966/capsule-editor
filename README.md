# capsule-editor

Web editor frontend for [GemCities](https://gemcities.com) — a free Gemini capsule hosting service.

Vanilla HTML, CSS, and JavaScript. No frameworks, no npm, no external CDN dependencies. Everything is self-hosted.

## Features

- File tree for managing .gmi files and directories
- Plain textarea editor with gemtext keyboard shortcuts
- Live gemtext preview (300ms debounce)
- Mobile-responsive layout
- ZIP export of all capsule files

## Related Repos

- [capsule-service](https://github.com/njb1966/capsule-service) — Go backend API (also contains full project docs)
- [capsule-deploy](https://github.com/njb1966/capsule-deploy) — Config templates, systemd units, setup scripts

## License

AGPL-3.0 — see [LICENSE](LICENSE)