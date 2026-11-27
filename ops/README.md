# Field-study safety nets (26 Nov 2026)

Both scripts only read from the running stack; they never stop, rebuild or change it.

| Script | When (WIB) | What |
|---|---|---|
| `samudra-backup.sh [stack]` | daily 02.00 | Consistent copy of the SQLite database (`VACUUM INTO`) and a Redis snapshot to `/root/samudra-backups/<stack>/`, 14 days kept, one line in `backup.log` |
| `samudra-health.sh [stack]` | daily 06.00 | One line in `health.log`: container states, last BMKG forecast (and how many of the last 3 reached BMKG), last WhatsApp message in and out, usage-log rows of yesterday, disk use |

The server clock is UTC+8, so 02.00 WIB = 03:00 and 06.00 WIB = 07:00 in the crontab.
Restore (only if needed, ask first): stop the backend, copy the `disaster-*.db` back to the `backend_data` volume as `disaster.db`, start it again.
