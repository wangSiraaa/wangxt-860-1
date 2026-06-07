# Trae Preflight

This folder is prepared for `wangxt-860-1`.

Use `.env` for stable local ports and compose project identity:

- APP_PORT: 18160
- API_PORT: 19160
- WEB_PORT: 20160
- DB_PORT: 21160
- REDIS_PORT: 22160

Smoke entry:

```bash
bash scripts/smoke.sh
```

The preflight files are environment scaffolding only. The generated business
project can replace or extend them when needed.
