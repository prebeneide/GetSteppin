# Supabase Database Migrations

Denne mappen inneholder SQL-filer for å opprette database-tabeller i Supabase.

## Hvordan kjøre migrasjonene

### Steg 1: Åpne Supabase SQL Editor

1. Gå til ditt Supabase-prosjekt på [supabase.com](https://supabase.com)
2. Klikk på "SQL Editor" i venstre meny
3. Klikk på "New query"

### Steg 2: Kjør migrasjonene i rekkefølge

Kjør hver fil i rekkefølge (001 → 002 → 003 → 004 → 005):

1. **001_create_user_profiles.sql** - Oppretter brukerprofiler
2. **002_create_friendships.sql** - Oppretter vennskapstabell
3. **003_create_step_data.sql** - Oppretter skrittdatatabell
4. **004_create_achievements.sql** - Oppretter achievement-tabeller
5. **005_insert_achievement_types.sql** - Legger inn alle emoji-achievements

### Hvordan kjøre en SQL-fil:

1. Åpne filen i en teksteditor
2. Kopier hele innholdet
3. Lim inn i SQL Editor i Supabase
4. Klikk "Run" eller trykk Ctrl+Enter (Cmd+Enter på Mac)
5. Sjekk at det ikke er noen feilmeldinger

### Viktig:

- Kjør filene i rekkefølge (001 før 002, osv.)
- Hvis du får feil, sjekk at forrige fil ble kjørt riktig
- Du kan se alle tabellene under "Table Editor" i Supabase etter at filene er kjørt

## Tabelloversikt

### user_profiles
- Lagrer brukerprofiler (utvidelse av auth.users)
- Inneholder: username, full_name, daily_step_goal

### friendships
- Lagrer vennskap mellom brukere
- Status: pending, accepted, blocked

### step_data
- Lagrer daglige skrittdata
- En rad per bruker per dag

### achievement_types
- Alle typer achievements/emojis som kan oppnås
- F.eks. 🍒 for 1000m, 🏆 for å vinne, osv.

### user_achievements
- Hvilke achievements brukere har oppnådd
- Inneholder count (antall ganger oppnådd)

### achievement_log
- Logg over når achievements blir oppnådd
- Brukes for å se historikk

