# Tastebuds

Keep a taste profile: the people and work whose taste you watch, and the ones that shaped your own work, with credit.

Status: planning. There is no code yet. The open issues describe version 1.

## The idea

A profile holds entries of two kinds:

- **Taste reference:** someone whose taste you watch and may draw from. Nothing has been taken from them yet.
- **Inspiration:** someone or something that gave your work something. You credit it by name.

An entry moves from taste reference to inspiration when it shapes a piece of work, and that work then credits it.

Each entry is a schema.org `Person`, `Organization` or `CreativeWork` with `sameAs` links to the entity's own site and profiles, so the same entity is recognisable wherever it appears.

## Version 1

- A file format: one JSON file per profile, with a JSON Schema.
- A browser app to edit and view a profile. No accounts and no backend.
- Export to JSON-LD.

## Showing a profile

- Show a taste reference as taste you watch, never as an influence.
- Link to the work. Use only the creator's own embeds. Copy no code, shaders or assets.
- Say that the profile's owner is not affiliated with or endorsed by the people in it.

## Documentation

Every feature ships with a guide, and with a short narrated video when it changes what you see.

## License

Apache-2.0. See [LICENSE](LICENSE).
